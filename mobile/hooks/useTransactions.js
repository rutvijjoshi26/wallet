// react custom hook file
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { API_URL } from '../constants/constants';

export const useTransactions = (userId) => {
    const [transactions, setTransactions] = useState([]);
    const [summary, setSummary] = useState({
        balance: 0,
        income: 0,
        expense: 0
    });
    const [isLoading, setIsLoading] = useState(true);

    const fetchTransactions = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/transactions/${userId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch transactions');
            }
            const data = await response.json();
            setTransactions(data);
        } catch (error) {
            console.error("Failed to fetch transactions:", error);
            throw error;
        }
    }, [userId]);

    const fetchSummary = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/transactions/summary/${userId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch summary');
            }
            const data = await response.json();
            setSummary(data);
        } catch (error) {
            console.error("Failed to fetch summary:", error);
            throw error;
        }
    }, [userId]);

    const loadData = useCallback(async () => {
        if (!userId) return;

        setIsLoading(true);
        try {
            await Promise.all([fetchTransactions(), fetchSummary()]);
        }
        catch (error) {
            console.error("Failed to load data:", error);
        } finally {
            setIsLoading(false);
        }
    }, [userId, fetchTransactions, fetchSummary]);

    const deleteTransaction = useCallback(async (transactionId) => {
        try {
            const response = await fetch(`${API_URL}/transactions/${transactionId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId }),
            });
            if (response.ok) {
                // Refresh data after deletion
                await loadData();
            } else {
                const errorData = await response.json();
                console.error("Failed to delete transaction:", errorData);
                Alert.alert("Error", errorData.error || "Failed to delete transaction");
            }
        } catch (error) {
            console.error("Error deleting transaction:", error);
            Alert.alert("Error", "An error occurred while deleting the transaction");
        }
    }, [userId, loadData]);

    return {
        transactions,
        summary,
        isLoading,
        loadData,
        deleteTransaction
    }
}