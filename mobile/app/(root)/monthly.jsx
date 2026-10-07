import { View, Text, TouchableOpacity, FlatList, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../../constants/constants';
import { styles } from '../../assets/styles/home.styles';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { TransactionItem } from '../../components/TransactionItem';
import PageLoader from '../../components/PageLoader';
import NoTransactionsFound from '../../components/NoTransactionsFound';

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

export default function MonthlyExpenses() {
    const { user } = useUser();
    const router = useRouter();

    const now = new Date();
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1); // 1-12
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [transactions, setTransactions] = useState([]);
    const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchMonthlyData = useCallback(async () => {
        if (!user?.id) return;

        try {
            const response = await fetch(
                `${API_URL}/transactions/month/${user.id}/${selectedYear}/${selectedMonth}`
            );

            if (!response.ok) {
                throw new Error('Failed to fetch monthly data');
            }

            const data = await response.json();
            setTransactions(data.transactions || []);
            setSummary(data.summary || { income: 0, expense: 0, balance: 0 });
        } catch (error) {
            console.error('Error fetching monthly data:', error);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }, [user?.id, selectedMonth, selectedYear]);

    useEffect(() => {
        setIsLoading(true);
        fetchMonthlyData();
    }, [fetchMonthlyData]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchMonthlyData();
    };

    const goToPreviousMonth = () => {
        if (selectedMonth === 1) {
            setSelectedMonth(12);
            setSelectedYear(selectedYear - 1);
        } else {
            setSelectedMonth(selectedMonth - 1);
        }
    };

    const goToNextMonth = () => {
        if (selectedMonth === 12) {
            setSelectedMonth(1);
            setSelectedYear(selectedYear + 1);
        } else {
            setSelectedMonth(selectedMonth + 1);
        }
    };

    const handleDelete = async (transactionId) => {
        // Not implementing delete here, redirect to home for full functionality
    };

    if (isLoading && !refreshing) return <PageLoader />;

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.logoutButton} onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color={COLORS.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Monthly View</Text>
                    <View style={{ width: 44 }} />
                </View>

                {/* Month Picker */}
                <View style={monthlyStyles.monthPicker}>
                    <TouchableOpacity onPress={goToPreviousMonth} style={monthlyStyles.arrowButton}>
                        <Ionicons name="chevron-back" size={28} color={COLORS.primary} />
                    </TouchableOpacity>
                    <View style={monthlyStyles.monthDisplay}>
                        <Text style={monthlyStyles.monthText}>{MONTHS[selectedMonth - 1]}</Text>
                        <Text style={monthlyStyles.yearText}>{selectedYear}</Text>
                    </View>
                    <TouchableOpacity onPress={goToNextMonth} style={monthlyStyles.arrowButton}>
                        <Ionicons name="chevron-forward" size={28} color={COLORS.primary} />
                    </TouchableOpacity>
                </View>

                {/* Monthly Summary */}
                <View style={styles.balanceCard}>
                    <Text style={styles.balanceTitle}>Monthly Balance</Text>
                    <Text style={styles.balanceAmount}>${parseFloat(summary.balance).toFixed(2)}</Text>
                    <View style={styles.balanceStats}>
                        <View style={styles.balanceStatItem}>
                            <Text style={styles.balanceStatLabel}>Income</Text>
                            <Text style={[styles.balanceStatAmount, { color: COLORS.income }]}>
                                +${parseFloat(summary.income).toFixed(2)}
                            </Text>
                        </View>
                        <View style={[styles.balanceStatItem, styles.statDivider]} />
                        <View style={styles.balanceStatItem}>
                            <Text style={styles.balanceStatLabel}>Expenses</Text>
                            <Text style={[styles.balanceStatAmount, { color: COLORS.expense }]}>
                                -${Math.abs(parseFloat(summary.expense)).toFixed(2)}
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.transactionsHeaderContainer}>
                    <Text style={styles.sectionTitle}>{MONTHS[selectedMonth - 1]} Transactions</Text>
                </View>
            </View>

            <FlatList
                style={styles.transactionsList}
                contentContainerStyle={styles.transactionsListContent}
                data={transactions}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <TransactionItem item={item} onDelete={handleDelete} />
                )}
                ListEmptyComponent={<NoTransactionsFound />}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            />
        </View>
    );
}

// Additional styles for monthly view
import { StyleSheet } from 'react-native';

const monthlyStyles = StyleSheet.create({
    monthPicker: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        backgroundColor: COLORS.card,
        borderRadius: 16,
        padding: 12,
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    arrowButton: {
        padding: 10,
    },
    monthDisplay: {
        flex: 1,
        alignItems: 'center',
    },
    monthText: {
        fontSize: 22,
        fontWeight: '700',
        color: COLORS.text,
    },
    yearText: {
        fontSize: 14,
        color: COLORS.textLight,
        marginTop: 2,
    },
});
