// File: functions/mpesa-payout-callback.js
// Callback handler for B2C payment results

exports.handler = async (event) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Parse callback data
        const callbackData = JSON.parse(event.body);
        console.log('B2C Callback received:', JSON.stringify(callbackData, null, 2));

        // Extract payment result
        const result = callbackData.Result;
        
        if (result) {
            const transactionStatus = result.ResultParameters?.ResultParameter?.find(
                param => param.Key === 'TransactionStatus'
            )?.Value;
            
            const receiptNumber = result.ResultParameters?.ResultParameter?.find(
                param => param.Key === 'ReceiptNumber'
            )?.Value;
            
            const conversationId = result.ConversationID;
            
            console.log('Payment Result:', {
                conversationId,
                transactionStatus,
                receiptNumber,
                resultCode: result.ResultCode,
                resultDesc: result.ResultDesc
            });

            // TODO: Update payment status in Firestore if needed
            // You can use the same Firestore REST API approach as in mpesa-callback.js
        }

        // Always return success to Safaricom
        return {
            statusCode: 200,
            body: JSON.stringify({
                ResultCode: 0,
                ResultDesc: "Success"
            })
        };

    } catch (error) {
        console.error('Error processing B2C callback:', error);
        
        return {
            statusCode: 200, // Still return 200 to avoid retries
            body: JSON.stringify({
                ResultCode: 1,
                ResultDesc: "Internal server error"
            })
        };
    }
};