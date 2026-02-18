// File: UON HUB/js/payments.js
// "Free" Backend Strategy - M-Pesa handling with Netlify Functions + Firebase listeners

class MpesaPayment {
    constructor() {
        this.paymentListener = null;
        this.pendingTransactions = new Map();
    }

    /**
     * Request M-Pesa STK Push
     * @param {number} amount - Payment amount
     * @param {string} phone - Customer phone number (format: 254XXXXXXXXX)
     * @param {string} tournamentId - Tournament ID for registration
     * @returns {Promise} - Resolves with payment result
     */
    async requestMpesaPush(amount, phone, tournamentId) {
        return new Promise(async (resolve, reject) => {
            try {
                // Validate phone number
                if (!this.validatePhoneNumber(phone)) {
                    throw new Error('Invalid phone number format. Use 254XXXXXXXXX');
                }

                // Generate a unique transaction ID
                const transactionId = this.generateTransactionId();

                // Call Netlify Function to initiate M-Pesa push
                const response = await fetch('/.netlify/functions/mpesa-push', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        amount,
                        phone,
                        transactionId,
                        tournamentId,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    })
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || 'Failed to initiate M-Pesa push');
                }

                // Store pending transaction
                this.pendingTransactions.set(transactionId, {
                    amount,
                    phone,
                    tournamentId,
                    status: 'pending',
                    timestamp: new Date(),
                    resolve,
                    reject
                });

                // Set timeout for payment (2 minutes)
                const timeout = setTimeout(() => {
                    if (this.pendingTransactions.has(transactionId)) {
                        this.pendingTransactions.delete(transactionId);
                        reject(new Error('Payment timeout - please try again'));
                    }
                }, 120000);

                // Store timeout reference
                this.pendingTransactions.get(transactionId).timeout = timeout;

                // Start listening for payment completion
                this.listenForPaymentCompletion(transactionId, tournamentId);

            } catch (error) {
                console.error('M-Pesa push error:', error);
                reject(error);
            }
        });
    }

    /**
     * Listen for payment completion in Firestore
     * @param {string} transactionId - Transaction ID to monitor
     * @param {string} tournamentId - Tournament ID for verification
     */
    listenForPaymentCompletion(transactionId, tournamentId) {
        // Clean up any existing listener
        if (this.paymentListener) {
            this.paymentListener();
        }

        // Set up Firestore listener for payments collection
        this.paymentListener = db.collection('payments')
            .where('transactionId', '==', transactionId)
            .where('status', '==', 'completed')
            .onSnapshot((snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added' || change.type === 'modified') {
                        const payment = change.doc.data();
                        
                        // Verify this matches our pending transaction
                        if (this.pendingTransactions.has(transactionId) && 
                            payment.tournamentId === tournamentId) {
                            
                            this.handleCompletedPayment(transactionId, payment);
                        }
                    }
                });
            }, (error) => {
                console.error('Payment listener error:', error);
            });
    }

    /**
     * Handle completed payment
     * @param {string} transactionId 
     * @param {Object} payment 
     */
    handleCompletedPayment(transactionId, payment) {
        const pendingTransaction = this.pendingTransactions.get(transactionId);
        
        if (pendingTransaction) {
            // Clear timeout
            clearTimeout(pendingTransaction.timeout);
            
            // Remove from pending
            this.pendingTransactions.delete(transactionId);
            
            // Clean up listener
            if (this.paymentListener) {
                this.paymentListener();
                this.paymentListener = null;
            }

            // Return success with payment details
            pendingTransaction.resolve({
                success: true,
                transactionId: payment.transactionId,
                amount: payment.amount,
                mpesaReceiptNumber: payment.mpesaReceiptNumber,
                phoneNumber: payment.phoneNumber,
                tournamentId: payment.tournamentId,
                timestamp: payment.completedAt
            });
        }
    }

    /**
     * Listen for tournament registration completion
     * @param {string} userId - User ID
     * @param {string} tournamentId - Tournament ID
     * @returns {Promise} - Resolves when registration is confirmed
     */
    waitForRegistrationConfirmation(userId, tournamentId) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                unsubscribe();
                reject(new Error('Registration confirmation timeout'));
            }, 10000);

            const unsubscribe = db.collection('tournamentRegistrations')
                .where('userId', '==', userId)
                .where('tournamentId', '==', tournamentId)
                .where('status', '==', 'confirmed')
                .onSnapshot((snapshot) => {
                    if (!snapshot.empty) {
                        clearTimeout(timeout);
                        unsubscribe();
                        resolve({
                            success: true,
                            registration: snapshot.docs[0].data()
                        });
                    }
                }, (error) => {
                    clearTimeout(timeout);
                    unsubscribe();
                    reject(error);
                });
        });
    }

    /**
     * Validate phone number format
     * @param {string} phone 
     * @returns {boolean}
     */
    validatePhoneNumber(phone) {
        // Basic validation for 254XXXXXXXXX format
        const phoneRegex = /^254[0-9]{9}$/;
        return phoneRegex.test(phone);
    }

    /**
     * Generate unique transaction ID
     * @returns {string}
     */
    generateTransactionId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `TXN_${timestamp}_${random}`.toUpperCase();
    }
}

// Export for use in other files
window.MpesaPayment = MpesaPayment;

// Usage example (for tournament-details.js):
/*
async function handleTournamentRegistration(tournamentId, amount) {
    const payment = new MpesaPayment();
    
    try {
        // Get user phone number (from profile or input)
        const phone = document.getElementById('phoneInput').value;
        
        // Request M-Pesa push
        const paymentResult = await payment.requestMpesaPush(amount, phone, tournamentId);
        
        if (paymentResult.success) {
            // Wait for registration confirmation
            const registrationResult = await payment.waitForRegistrationConfirmation(
                currentUser.uid, 
                tournamentId
            );
            
            if (registrationResult.success) {
                // Update UI to show successful registration
                showSuccessMessage('Registration successful!');
                updateTournamentStatus('registered');
            }
        }
    } catch (error) {
        showErrorMessage(error.message);
    }
}
*/