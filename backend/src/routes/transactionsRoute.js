import express from "express";
import { createTransaction, deleteTransactionById, getTransactionsByUserId, getTransactionSummaryByUserId, getTransactionsByMonth, updateTransaction } from "../controllers/transactionsController.js";

const router = express.Router();

// IMPORTANT: More specific routes must come BEFORE catch-all routes
router.get("/month/:userId/:year/:month", getTransactionsByMonth);
router.get("/summary/:userId", getTransactionSummaryByUserId);
router.get("/:userId", getTransactionsByUserId);

router.post("/", createTransaction);

router.put("/:id", updateTransaction);
router.delete("/:id", deleteTransactionById);

export default router;