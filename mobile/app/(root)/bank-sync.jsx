import { useUser } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, FlatList,
    Modal, TextInput, Alert, ScrollView, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { create, open } from 'react-native-plaid-link-sdk';
import { styles } from '../../assets/styles/bank-sync.styles';
import { COLORS } from '../../constants/colors';
import { API_URL } from '../../constants/constants';
import SafeScreen from '../../components/SafeScreen';

const CATEGORIES = [
    { label: 'Food & Drinks', icon: 'fast-food' },
    { label: 'Shopping', icon: 'cart' },
    { label: 'Transportation', icon: 'car' },
    { label: 'Entertainment', icon: 'film' },
    { label: 'Bills', icon: 'receipt' },
    { label: 'Other', icon: 'pricetag-outline' },
];

const CATEGORY_ICONS = {
    'Food & Drinks': 'fast-food',
    Shopping: 'cart',
    Transportation: 'car',
    Entertainment: 'film',
    Bills: 'receipt',
    Other: 'pricetag-outline',
};

export default function BankSync() {
    const { user } = useUser();
    const router = useRouter();

    const [accounts, setAccounts] = useState([]);
    const [pending, setPending] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [connecting, setConnecting] = useState(false);

    // Edit modal state
    const [editItem, setEditItem] = useState(null);
    const [editTitle, setEditTitle] = useState('');
    const [editCategory, setEditCategory] = useState('Other');

    const loadData = useCallback(async () => {
        if (!user?.id) return;
        try {
            const [accountsRes, pendingRes] = await Promise.all([
                fetch(`${API_URL}/plaid/accounts/${user.id}`),
                fetch(`${API_URL}/plaid/pending/${user.id}`),
            ]);
            const accountsData = await accountsRes.json();
            const pendingData = await pendingRes.json();
            setAccounts(Array.isArray(accountsData) ? accountsData : []);
            setPending(Array.isArray(pendingData) ? pendingData : []);
        } catch (error) {
            console.error('Error loading bank sync data:', error);
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleConnectBank = async () => {
        setConnecting(true);
        try {
            const res = await fetch(`${API_URL}/plaid/link-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id }),
            });
            const { link_token } = await res.json();

            await create({ token: link_token });

            open({
                onSuccess: async (success) => {
                    const institutionName = success.metadata?.institution?.name || 'My Bank';
                    await fetch(`${API_URL}/plaid/exchange-token`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            public_token: success.publicToken,
                            user_id: user.id,
                            institution_name: institutionName,
                        }),
                    });
                    await loadData();
                    Alert.alert('Connected!', `${institutionName} has been linked.`);
                },
                onExit: () => {},
            });
        } catch (error) {
            Alert.alert('Error', 'Could not connect account. Please try again.');
        } finally {
            setConnecting(false);
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        try {
            const res = await fetch(`${API_URL}/plaid/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id }),
            });
            const data = await res.json();
            setPending(Array.isArray(data.pending) ? data.pending : []);
        } catch (error) {
            Alert.alert('Error', 'Sync failed. Please try again.');
        } finally {
            setSyncing(false);
        }
    };

    const handleConfirm = async (item) => {
        try {
            const res = await fetch(`${API_URL}/plaid/pending/${item.id}/confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id }),
            });
            if (res.ok) {
                setPending(prev => prev.filter(p => p.id !== item.id));
            }
        } catch (error) {
            Alert.alert('Error', 'Could not confirm transaction.');
        }
    };

    const handleDiscard = (item) => {
        Alert.alert('Discard Transaction', 'Remove this transaction from the queue?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Discard', style: 'destructive',
                onPress: async () => {
                    try {
                        const res = await fetch(`${API_URL}/plaid/pending/${item.id}`, {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ user_id: user.id }),
                        });
                        if (res.ok) setPending(prev => prev.filter(p => p.id !== item.id));
                    } catch {
                        Alert.alert('Error', 'Could not discard transaction.');
                    }
                },
            },
        ]);
    };

    const openEditModal = (item) => {
        setEditItem(item);
        setEditTitle(item.title);
        setEditCategory(item.category);
    };

    const handleSaveEdit = async () => {
        if (!editTitle.trim()) return;
        try {
            const res = await fetch(`${API_URL}/plaid/pending/${editItem.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: editTitle.trim(), category: editCategory, user_id: user.id }),
            });
            if (res.ok) {
                const updated = await res.json();
                setPending(prev => prev.map(p => p.id === updated.id ? updated : p));
            }
        } catch {
            Alert.alert('Error', 'Could not save changes.');
        } finally {
            setEditItem(null);
        }
    };

    const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const renderPendingItem = ({ item, index }) => (
        <View style={styles.pendingCard}>
            <View style={styles.pendingCardMain}>
                <View style={styles.categoryIcon}>
                    <Ionicons
                        name={CATEGORY_ICONS[item.category] || 'pricetag-outline'}
                        size={20}
                        color={COLORS.primary}
                    />
                </View>
                <View style={styles.pendingInfo}>
                    <Text style={styles.pendingTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.pendingMeta}>{item.category} · {formatDate(item.transaction_date)}</Text>
                </View>
                <Text style={styles.pendingAmount}>
                    -${Math.abs(parseFloat(item.amount)).toFixed(2)}
                </Text>
            </View>
            <View style={styles.pendingActions}>
                <TouchableOpacity style={[styles.actionButton, styles.actionButtonBorder]} onPress={() => openEditModal(item)}>
                    <Ionicons name="pencil-outline" size={16} color={COLORS.textLight} />
                    <Text style={[styles.actionButtonText, { color: COLORS.textLight }]}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, styles.actionButtonBorder]} onPress={() => handleDiscard(item)}>
                    <Ionicons name="close-outline" size={16} color={COLORS.expense} />
                    <Text style={[styles.actionButtonText, { color: COLORS.expense }]}>Discard</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={() => handleConfirm(item)}>
                    <Ionicons name="checkmark-outline" size={16} color={COLORS.income} />
                    <Text style={[styles.actionButtonText, { color: COLORS.income }]}>Add</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    if (loading) {
        return (
            <SafeScreen>
                <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            </SafeScreen>
        );
    }

    return (
        <SafeScreen>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color={COLORS.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Bank Sync</Text>
                    {accounts.length > 0 ? (
                        <TouchableOpacity style={styles.syncButton} onPress={handleSync} disabled={syncing}>
                            {syncing
                                ? <ActivityIndicator size="small" color={COLORS.white} />
                                : <Ionicons name="sync-outline" size={16} color={COLORS.white} />
                            }
                            <Text style={styles.syncButtonText}>{syncing ? 'Syncing…' : 'Sync'}</Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={{ width: 70 }} />
                    )}
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                    {/* Connected Accounts */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Connected Accounts</Text>
                        <View style={styles.accountsCard}>
                            {accounts.length === 0 && (
                                <Text style={styles.emptyAccountsText}>No accounts connected yet</Text>
                            )}
                            {accounts.map((account, index) => (
                                <View
                                    key={account.id}
                                    style={[styles.accountRow, index === accounts.length - 1 && styles.accountRowLast]}
                                >
                                    <Ionicons name="business-outline" size={20} color={COLORS.primary} />
                                    <Text style={styles.accountName}>{account.institution_name || 'Bank Account'}</Text>
                                    <Ionicons name="checkmark-circle" size={18} color={COLORS.income} />
                                </View>
                            ))}
                            <TouchableOpacity style={styles.connectButton} onPress={handleConnectBank} disabled={connecting}>
                                {connecting
                                    ? <ActivityIndicator size="small" color={COLORS.primary} />
                                    : <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
                                }
                                <Text style={styles.connectButtonText}>
                                    {connecting ? 'Opening…' : accounts.length > 0 ? 'Add Another Account' : 'Connect Bank or Card'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Review Queue */}
                    <View style={styles.section}>
                        <View style={styles.pendingHeader}>
                            <Text style={styles.sectionTitle}>Review Queue</Text>
                            {pending.length > 0 && (
                                <Text style={styles.pendingCount}>{pending.length} pending</Text>
                            )}
                        </View>
                    </View>

                    <View style={styles.pendingList}>
                        {pending.length === 0 ? (
                            <View style={styles.noPendingContainer}>
                                <Ionicons name="checkmark-done-outline" size={40} color={COLORS.border} />
                                <Text style={styles.noPendingText}>
                                    {accounts.length === 0
                                        ? 'Connect an account and sync to import expenses'
                                        : 'All caught up — tap Sync to check for new expenses'}
                                </Text>
                            </View>
                        ) : (
                            pending.map((item, index) => (
                                <View key={item.id}>
                                    {renderPendingItem({ item, index })}
                                </View>
                            ))
                        )}
                    </View>
                </ScrollView>

                {/* Edit Modal */}
                <Modal visible={!!editItem} transparent animationType="slide" onRequestClose={() => setEditItem(null)}>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHandle} />
                            <Text style={styles.modalTitle}>Edit Transaction</Text>

                            <Text style={styles.modalLabel}>Title</Text>
                            <TextInput
                                style={styles.modalInput}
                                value={editTitle}
                                onChangeText={setEditTitle}
                                placeholder="Transaction name"
                                placeholderTextColor={COLORS.textLight}
                            />

                            <Text style={styles.modalLabel}>Category</Text>
                            <View style={styles.categoryGrid}>
                                {CATEGORIES.map(({ label, icon }) => (
                                    <TouchableOpacity
                                        key={label}
                                        style={[styles.categoryChip, editCategory === label && styles.categoryChipActive]}
                                        onPress={() => setEditCategory(label)}
                                    >
                                        <Ionicons
                                            name={icon}
                                            size={14}
                                            color={editCategory === label ? COLORS.white : COLORS.text}
                                        />
                                        <Text style={[styles.categoryChipText, editCategory === label && styles.categoryChipTextActive]}>
                                            {label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <TouchableOpacity style={styles.modalSaveButton} onPress={handleSaveEdit}>
                                <Text style={styles.modalSaveButtonText}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            </View>
        </SafeScreen>
    );
}
