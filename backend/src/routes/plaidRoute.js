import express from 'express';
import {
    createLinkToken,
    exchangePublicToken,
    getConnectedAccounts,
    syncTransactions,
    getPendingTransactions,
    updatePendingTransaction,
    confirmTransaction,
    discardTransaction,
} from '../controllers/plaidController.js';

const router = express.Router();

router.post('/link-token', createLinkToken);
router.post('/exchange-token', exchangePublicToken);
router.post('/sync', syncTransactions);
router.get('/accounts/:userId', getConnectedAccounts);
router.get('/pending/:userId', getPendingTransactions);
router.put('/pending/:id', updatePendingTransaction);
router.post('/pending/:id/confirm', confirmTransaction);
router.delete('/pending/:id', discardTransaction);

export default router;
