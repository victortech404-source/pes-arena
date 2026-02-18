const functions = require('firebase-functions/v2');
const { onCall } = require('firebase-functions/v2/https');
const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const axios = require('axios');
const { defineString, defineInt, defineSecret } = require('firebase-functions/params');

admin.initializeApp();

// Define configuration parameters with the new system
const consumerKey = defineString('MPESA_CONSUMER_KEY');
const consumerSecret = defineSecret('MPESA_CONSUMER_SECRET');
const passkey = defineString('MPESA_PASSKEY');
const businessShortCode = defineString('MPESA_BUSINESS_SHORTCODE', { default: '174379' });
const callbackUrl = defineString('MPESA_CALLBACK_URL');
const environment = defineString('MPESA_ENVIRONMENT', { default: 'sandbox' });

// Helper: Generate timestamp
function generateTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

// Helper: Generate M-Pesa password
function generateMpesaPassword(shortCode, passkeyValue, timestamp) {
    const data = shortCode + passkeyValue + timestamp;
    return Buffer.from(data).toString('base64');
}

// Helper: Get M-Pesa OAuth token
async function getMpesaToken(consumerKeyValue, consumerSecretValue) {
    try {
        const auth = Buffer.from(`${consumerKeyValue}:${consumerSecretValue}`).toString('base64');
        const response = await axios.get(
            environment.value() === 'sandbox' 
                ? 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
                : 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
            {
                headers: { 'Authorization': `Basic ${auth}` }
            }
        );
        return response.data.access_token;
    } catch (error) {
        console.error('Error getting M-Pesa token:', error);
        throw new Error('Failed to authenticate with M-Pesa');
    }
}

// 1. STK Push Function
exports.mpesaStkPush = onCall(
    { secrets: [consumerSecret] }, // Bind the secret to this function
    async (request) => {
        if (!request.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Login required');
        }

        const { amount, phone, tournamentId } = request.data;

        // Validate inputs
        if (!amount || !phone || !tournamentId) {
            throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
        }

        try {
            const timestamp = generateTimestamp();
            const password = generateMpesaPassword(
                businessShortCode.value(),
                passkey.value(),
                timestamp
            );

            // Get token using secret
            const accessToken = await getMpesaToken(
                consumerKey.value(),
                consumerSecret.value()
            );

            const stkPushUrl = environment.value() === 'sandbox'
                ? 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
                : 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

            const response = await axios.post(stkPushUrl, {
                BusinessShortCode: businessShortCode.value(),
                Password: password,
                Timestamp: timestamp,
                TransactionType: "CustomerPayBillOnline",
                Amount: amount,
                PartyA: phone,
                PartyB: businessShortCode.value(),
                PhoneNumber: phone,
                CallBackURL: callbackUrl.value(),
                AccountReference: `PESARENA_${tournamentId.slice(0, 8)}`,
                TransactionDesc: "Tournament Entry Fee"
            }, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            const transactionId = `PESA${Date.now()}`;
            
            // Save pending payment
            await admin.firestore().collection('payments').doc(transactionId).set({
                userId: request.auth.uid,
                tournamentId,
                amount: parseFloat(amount),
                phone,
                transactionId,
                checkoutRequestID: response.data.CheckoutRequestID,
                status: 'pending',
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });

            return {
                success: true,
                checkoutRequestID: response.data.CheckoutRequestID,
                transactionId
            };

        } catch (error) {
            console.error('STK Push Error:', error);
            throw new functions.https.HttpsError('internal', error.message);
        }
    }
);

// 2. M-Pesa Callback
exports.mpesaCallback = onRequest(async (req, res) => {
    try {
        console.log('Callback received:', JSON.stringify(req.body));
        
        // Respond immediately to M-Pesa
        res.status(200).json({ ResultCode: 0, ResultDesc: "Success" });

        const callbackData = req.body.Body?.stkCallback;
        if (!callbackData) return;

        const { ResultCode, CheckoutRequestID } = callbackData;

        // Find payment record
        const paymentQuery = await admin.firestore()
            .collection('payments')
            .where('checkoutRequestID', '==', CheckoutRequestID)
            .limit(1)
            .get();

        if (paymentQuery.empty) {
            console.error(`No payment found for CheckoutRequestID: ${CheckoutRequestID}`);
            return;
        }

        const paymentDoc = paymentQuery.docs[0];
        const paymentData = paymentDoc.data();

        if (ResultCode === 0) {
            // Payment successful
            const metadata = callbackData.CallbackMetadata?.Item;
            const receiptNumber = metadata?.find(item => item.Name === 'MpesaReceiptNumber')?.Value;

            await paymentDoc.ref.update({
                status: 'completed',
                mpesaReceiptNumber: receiptNumber,
                completedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Update tournament registration
            const regQuery = await admin.firestore()
                .collection('tournamentRegistrations')
                .where('userId', '==', paymentData.userId)
                .where('tournamentId', '==', paymentData.tournamentId)
                .limit(1)
                .get();

            if (!regQuery.empty) {
                await regQuery.docs[0].ref.update({
                    status: 'approved',
                    paymentStatus: 'completed',
                    mpesaReceiptNumber: receiptNumber
                });
            }
        } else {
            // Payment failed
            await paymentDoc.ref.update({
                status: 'failed',
                resultCode: ResultCode,
                resultDesc: callbackData.ResultDesc,
                failedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }

    } catch (error) {
        console.error('Error processing callback:', error);
    }
});