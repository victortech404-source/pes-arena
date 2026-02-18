// File: functions/mpesa-payout.js
// M-Pesa B2C Payout function for tournament prizes

const axios = require('axios');
const crypto = require('crypto');

// Safaricom API endpoints
const SAFARICOM_API = {
    sandbox: {
        auth: 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
        b2c: 'https://sandbox.safaricom.co.ke/mpesa/b2c/v1/paymentrequest'
    },
    production: {
        auth: 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
        b2c: 'https://api.safaricom.co.ke/mpesa/b2c/v1/paymentrequest'
    }
};

// Generate Base64 encoded credentials for auth
const getAuthHeader = () => {
    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    return `Basic ${credentials}`;
};

// Get access token from Safaricom
const getAccessToken = async () => {
    try {
        const env = process.env.NODE_ENV === 'production' ? 'production' : 'sandbox';
        const authUrl = SAFARICOM_API[env].auth;
        
        const response = await axios.get(authUrl, {
            headers: {
                Authorization: getAuthHeader()
            }
        });

        return response.data.access_token;
    } catch (error) {
        console.error('Error getting access token:', error.response?.data || error.message);
        throw new Error('Failed to get M-Pesa access token');
    }
};

// Format phone number to international format
const formatPhoneNumber = (phone) => {
    // Remove any non-numeric characters
    let cleaned = phone.replace(/\D/g, '');
    
    // Convert 07XXXXXXXX to 254XXXXXXXXX
    if (cleaned.startsWith('0')) {
        cleaned = '254' + cleaned.substring(1);
    }
    // Convert 7XXXXXXXX to 2547XXXXXXXX
    else if (cleaned.startsWith('7')) {
        cleaned = '254' + cleaned;
    }
    
    return cleaned;
};

// Calculate prize amounts based on Chiromo Split
const calculatePrizes = (totalPool) => {
    // Round to nearest whole number (KES doesn't support cents)
    const firstPlace = Math.round(totalPool * 0.60); // 60%
    const secondPlace = Math.round(totalPool * 0.25); // 25%
    const thirdPlace = Math.round(totalPool * 0.10); // 10%
    const arenaFee = totalPool - (firstPlace + secondPlace + thirdPlace); // 5% (remainder)
    
    // Adjust if rounding caused any discrepancy
    const totalDistributed = firstPlace + secondPlace + thirdPlace;
    const calculatedFee = totalPool - totalDistributed;
    
    return {
        firstPlace,
        secondPlace,
        thirdPlace,
        arenaFee: calculatedFee,
        totalDistributed
    };
};

// Validate admin access
const validateAdminAccess = (event) => {
    // Check for admin secret header
    const adminSecret = event.headers['x-admin-secret'];
    const expectedSecret = process.env.ADMIN_SECRET;
    
    if (!expectedSecret) {
        console.warn('ADMIN_SECRET not set in environment variables');
        return false;
    }
    
    return adminSecret === expectedSecret;
};

// Generate security credential (placeholder for sandbox)
const getSecurityCredential = () => {
    // TODO: For production, encrypt the initiator password using Safaricom's public key
    // For sandbox, use the placeholder string provided in documentation
    return process.env.MPESA_B2C_SECURITY_CREDENTIAL || 'Safaricom999!*!';
};

// Initiate B2C payment for a single recipient
const initiateB2CPayment = async (accessToken, paymentDetails) => {
    try {
        const env = process.env.NODE_ENV === 'production' ? 'production' : 'sandbox';
        const b2cUrl = SAFARICOM_API[env].b2c;
        
        // Get current timestamp for unique transaction ID
        const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '');
        const originatorConversationId = `PES${timestamp}${Math.floor(Math.random() * 1000)}`;
        
        // Prepare B2C request body
        const b2cBody = {
            InitiatorName: process.env.MPESA_B2C_INITIATOR || 'testapi',
            SecurityCredential: getSecurityCredential(),
            CommandID: 'BusinessPayment',
            Amount: paymentDetails.amount,
            PartyA: process.env.MPESA_SHORTCODE,
            PartyB: paymentDetails.phone,
            Remarks: paymentDetails.remarks || 'PES ARENA Tournament Prize',
            QueueTimeOutURL: `${process.env.URL}/.netlify/functions/mpesa-payout-callback`,
            ResultURL: `${process.env.URL}/.netlify/functions/mpesa-payout-callback`,
            Occasion: paymentDetails.occasion || 'Tournament Winnings'
        };

        console.log(`Initiating B2C payment for ${paymentDetails.position}:`, {
            amount: paymentDetails.amount,
            phone: paymentDetails.phone
        });

        const response = await axios.post(b2cUrl, b2cBody, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        return {
            success: true,
            position: paymentDetails.position,
            amount: paymentDetails.amount,
            phone: paymentDetails.phone,
            conversationId: response.data.ConversationID,
            originatorConversationId: response.data.OriginatorConversationID,
            responseCode: response.data.ResponseCode,
            responseDescription: response.data.ResponseDescription
        };
    } catch (error) {
        console.error(`B2C payment failed for ${paymentDetails.position}:`, error.response?.data || error.message);
        
        return {
            success: false,
            position: paymentDetails.position,
            amount: paymentDetails.amount,
            phone: paymentDetails.phone,
            error: error.response?.data || error.message
        };
    }
};

// Update tournament in Firestore
const updateTournamentInFirestore = async (tournamentId, payoutResults) => {
    try {
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const apiKey = process.env.FIREBASE_API_KEY;
        
        // Use Firestore REST API
        const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/tournaments/${tournamentId}?key=${apiKey}`;
        
        // Prepare update data
        const updateData = {
            fields: {
                payoutStatus: { stringValue: 'paid_out' },
                paidOutAt: { timestampValue: new Date().toISOString() },
                payoutResults: {
                    arrayValue: {
                        values: payoutResults.map(result => ({
                            mapValue: {
                                fields: {
                                    position: { stringValue: result.position },
                                    amount: { integerValue: result.amount },
                                    phone: { stringValue: result.phone },
                                    success: { booleanValue: result.success },
                                    conversationId: { stringValue: result.conversationId || '' },
                                    ...(result.error && { error: { stringValue: result.error } })
                                }
                            }
                        }))
                    }
                },
                totalPayoutAmount: { integerValue: payoutResults.reduce((sum, r) => sum + r.amount, 0) }
            }
        };

        // Only add transaction IDs if available
        payoutResults.forEach((result, index) => {
            if (result.conversationId) {
                if (!updateData.fields.transactionIds) {
                    updateData.fields.transactionIds = { arrayValue: { values: [] } };
                }
                updateData.fields.transactionIds.arrayValue.values.push({
                    stringValue: result.conversationId
                });
            }
        });

        const response = await fetch(url, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updateData)
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error?.message || 'Failed to update tournament');
        }

        return data;
    } catch (error) {
        console.error('Error updating tournament in Firestore:', error);
        throw error;
    }
};

// Main handler function
exports.handler = async (event) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    // Validate admin access
    if (!validateAdminAccess(event)) {
        return {
            statusCode: 403,
            body: JSON.stringify({ error: 'Unauthorized - Admin access required' })
        };
    }

    try {
        // Parse request body
        const { totalPool, winners, tournamentId } = JSON.parse(event.body);

        // Validate required fields
        if (!totalPool || !winners || !tournamentId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ 
                    error: 'Missing required fields: totalPool, winners (with phone numbers), tournamentId' 
                })
            };
        }

        // Validate winners object has required positions
        if (!winners.firstPlace || !winners.secondPlace || !winners.thirdPlace) {
            return {
                statusCode: 400,
                body: JSON.stringify({ 
                    error: 'Winners must include firstPlace, secondPlace, and thirdPlace phone numbers' 
                })
            };
        }

        // Calculate prize amounts
        const prizes = calculatePrizes(totalPool);

        // Format phone numbers
        const formattedWinners = {
            firstPlace: formatPhoneNumber(winners.firstPlace),
            secondPlace: formatPhoneNumber(winners.secondPlace),
            thirdPlace: formatPhoneNumber(winners.thirdPlace)
        };

        // Get access token
        const accessToken = await getAccessToken();

        // Prepare payment details for each winner
        const paymentDetails = [
            {
                position: '1st Place',
                amount: prizes.firstPlace,
                phone: formattedWinners.firstPlace,
                remarks: 'PES ARENA Tournament 1st Prize',
                occasion: 'Tournament Winner'
            },
            {
                position: '2nd Place',
                amount: prizes.secondPlace,
                phone: formattedWinners.secondPlace,
                remarks: 'PES ARENA Tournament 2nd Prize',
                occasion: 'Tournament Runner-up'
            },
            {
                position: '3rd Place',
                amount: prizes.thirdPlace,
                phone: formattedWinners.thirdPlace,
                remarks: 'PES ARENA Tournament 3rd Prize',
                occasion: 'Tournament Third Place'
            }
        ];

        // Initiate B2C payments for all winners
        const payoutResults = [];
        for (const payment of paymentDetails) {
            const result = await initiateB2CPayment(accessToken, payment);
            payoutResults.push(result);
            
            // Small delay between requests to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Update tournament in Firestore
        try {
            await updateTournamentInFirestore(tournamentId, payoutResults);
        } catch (dbError) {
            console.error('Failed to update tournament in Firestore:', dbError);
            // Continue - we still have the payout results
        }

        // Prepare summary
        const summary = {
            totalPool,
            prizes,
            payoutsInitiated: payoutResults.filter(r => r.success).length,
            payoutsFailed: payoutResults.filter(r => !r.success).length,
            results: payoutResults,
            arenaFee: prizes.arenaFee,
            timestamp: new Date().toISOString()
        };

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                message: 'Payout process completed',
                summary
            })
        };

    } catch (error) {
        console.error('Payout function error:', error);
        
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Failed to process payouts',
                details: error.message
            })
        };
    }
};