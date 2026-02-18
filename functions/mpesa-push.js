// File: functions/mpesa-push.js
// M-Pesa STK Push initiation function for Netlify

const axios = require('axios');

// Safaricom API endpoints
const SAFARICOM_API = {
    sandbox: {
        auth: 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
        stkPush: 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
    },
    production: {
        auth: 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
        stkPush: 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
    }
};

// Generate Base64 encoded credentials
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

// Generate timestamp in format YYYYMMDDHHmmss
const getTimestamp = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
};

// Generate password for STK push
const generatePassword = (shortCode, passkey, timestamp) => {
    const str = shortCode + passkey + timestamp;
    return Buffer.from(str).toString('base64');
};

exports.handler = async (event) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Parse request body
        const { amount, phone, transactionId, tournamentId } = JSON.parse(event.body);

        // Validate required fields
        if (!amount || !phone || !transactionId || !tournamentId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ 
                    error: 'Missing required fields: amount, phone, transactionId, tournamentId' 
                })
            };
        }

        // Format phone number
        const formattedPhone = formatPhoneNumber(phone);

        // Get access token
        const accessToken = await getAccessToken();

        // Get environment variables
        const businessShortCode = process.env.MPESA_SHORTCODE;
        const passkey = process.env.MPESA_PASSKEY;
        const callbackUrl = `${process.env.URL}/.netlify/functions/mpesa-callback`;
        
        // Generate timestamp and password
        const timestamp = getTimestamp();
        const password = generatePassword(businessShortCode, passkey, timestamp);

        // Determine environment
        const env = process.env.NODE_ENV === 'production' ? 'production' : 'sandbox';
        const stkPushUrl = SAFARICOM_API[env].stkPush;

        // Prepare STK push request body
        const stkPushBody = {
            BusinessShortCode: businessShortCode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline',
            Amount: Math.floor(amount), // Ensure integer
            PartyA: formattedPhone,
            PartyB: businessShortCode,
            PhoneNumber: formattedPhone,
            CallBackURL: callbackUrl,
            AccountReference: tournamentId.substring(0, 12), // Max 12 chars
            TransactionDesc: `Tournament Registration - ${tournamentId}`
        };

        // Make STK push request
        const response = await axios.post(stkPushUrl, stkPushBody, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        // Check if STK push was successful
        if (response.data.ResponseCode === '0') {
            return {
                statusCode: 200,
                body: JSON.stringify({
                    success: true,
                    message: 'STK push sent successfully',
                    data: {
                        merchantRequestId: response.data.MerchantRequestID,
                        checkoutRequestId: response.data.CheckoutRequestID,
                        transactionId: transactionId,
                        responseDescription: response.data.ResponseDescription
                    }
                })
            };
        } else {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    error: 'STK push failed',
                    responseCode: response.data.ResponseCode,
                    responseDescription: response.data.ResponseDescription
                })
            };
        }

    } catch (error) {
        console.error('M-Pesa push error:', error.response?.data || error.message);
        
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Failed to initiate M-Pesa payment',
                details: error.response?.data || error.message
            })
        };
    }
};