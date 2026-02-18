// File: functions/mpesa-callback.js
// M-Pesa payment callback handler for Netlify

const axios = require('axios');

// Firestore REST API endpoint
const FIRESTORE_API = 'https://firestore.googleapis.com/v1/projects/your-project-id/databases/(default)/documents';

// Helper to extract relevant data from callback
const parseCallbackData = (callbackData) => {
    try {
        const stkCallback = callbackData.Body.stkCallback;
        
        return {
            merchantRequestId: stkCallback.MerchantRequestID,
            checkoutRequestId: stkCallback.CheckoutRequestID,
            resultCode: stkCallback.ResultCode,
            resultDesc: stkCallback.ResultDesc,
            amount: stkCallback.CallbackMetadata?.Item?.find(item => item.Name === 'Amount')?.Value,
            mpesaReceiptNumber: stkCallback.CallbackMetadata?.Item?.find(item => item.Name === 'MpesaReceiptNumber')?.Value,
            transactionDate: stkCallback.CallbackMetadata?.Item?.find(item => item.Name === 'TransactionDate')?.Value,
            phoneNumber: stkCallback.CallbackMetadata?.Item?.find(item => item.Name === 'PhoneNumber')?.Value
        };
    } catch (error) {
        console.error('Error parsing callback data:', error);
        throw new Error('Failed to parse callback data');
    }
};

// Save payment to Firestore using REST API
const savePaymentToFirestore = async (paymentData) => {
    try {
        // Get Firebase project ID from environment
        const projectId = process.env.FIREBASE_PROJECT_ID;
        
        // Create document in payments collection
        const document = {
            fields: {
                transactionId: { stringValue: paymentData.checkoutRequestId },
                amount: { integerValue: paymentData.amount },
                mpesaReceiptNumber: { stringValue: paymentData.mpesaReceiptNumber },
                phoneNumber: { stringValue: paymentData.phoneNumber },
                status: { stringValue: paymentData.resultCode === 0 ? 'completed' : 'failed' },
                resultCode: { integerValue: paymentData.resultCode },
                resultDesc: { stringValue: paymentData.resultDesc },
                merchantRequestId: { stringValue: paymentData.merchantRequestId },
                completedAt: { timestampValue: new Date().toISOString() },
                // Extract tournamentId from AccountReference in original request
                // You might need to pass this from the initial request
            }
        };

        // Add tournament ID if available (you'll need to pass this from the initial request)
        if (paymentData.tournamentId) {
            document.fields.tournamentId = { stringValue: paymentData.tournamentId };
        }

        // Make request to Firestore REST API
        const response = await axios.post(
            `${FIRESTORE_API.replace('your-project-id', projectId)}/payments`,
            document,
            {
                headers: {
                    'Content-Type': 'application/json',
                    // If using API key for authentication
                    'Authorization': `Bearer ${process.env.FIREBASE_API_KEY}`
                }
            }
        );

        return response.data;
    } catch (error) {
        console.error('Error saving to Firestore:', error.response?.data || error.message);
        throw error;
    }
};

// Alternative: Save to Firestore using fetch (no additional dependencies)
const savePaymentWithFetch = async (paymentData) => {
    try {
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const apiKey = process.env.FIREBASE_API_KEY;
        
        // Use Firestore REST API with API key
        const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/payments?key=${apiKey}`;
        
        const document = {
            fields: {
                transactionId: { stringValue: paymentData.checkoutRequestId },
                amount: { integerValue: paymentData.amount },
                mpesaReceiptNumber: { stringValue: paymentData.mpesaReceiptNumber },
                phoneNumber: { stringValue: paymentData.phoneNumber },
                status: { stringValue: paymentData.resultCode === 0 ? 'completed' : 'failed' },
                resultCode: { integerValue: paymentData.resultCode },
                resultDesc: { stringValue: paymentData.resultDesc },
                timestamp: { timestampValue: new Date().toISOString() }
            }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(document)
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error?.message || 'Failed to save to Firestore');
        }

        return data;
    } catch (error) {
        console.error('Error saving to Firestore:', error);
        throw error;
    }
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
        // Parse callback data from Safaricom
        const callbackData = JSON.parse(event.body);
        console.log('Received M-Pesa callback:', JSON.stringify(callbackData, null, 2));

        // Extract relevant payment information
        const paymentInfo = parseCallbackData(callbackData);

        // Save to Firestore (using either method)
        try {
            // Method 1: Using axios (if installed)
            // await savePaymentToFirestore(paymentInfo);
            
            // Method 2: Using fetch (no additional dependencies)
            await savePaymentWithFetch(paymentInfo);
            
            console.log('Payment saved to Firestore successfully');
        } catch (dbError) {
            console.error('Failed to save to Firestore:', dbError);
            // Still return success to Safaricom to avoid retries
            // The payment will need to be reconciled manually
        }

        // Always return success to Safaricom (they will retry if we return error)
        return {
            statusCode: 200,
            body: JSON.stringify({
                ResultCode: 0,
                ResultDesc: "Success"
            })
        };

    } catch (error) {
        console.error('Error processing callback:', error);
        
        // Return error to Safaricom (they will retry)
        return {
            statusCode: 200, // Still return 200 to avoid CORS issues
            body: JSON.stringify({
                ResultCode: 1,
                ResultDesc: "Internal server error"
            })
        };
    }
};