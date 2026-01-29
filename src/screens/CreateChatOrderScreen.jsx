import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import client from '../api/client';

const CreateChatOrderScreen = ({ route, navigation }) => {
    const { orderId, vendorId, orderMsg } = route.params;
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [products, setProducts] = useState([
        { name: '', quantity: '1', price: '0', discount: '0', totalAmount: 0 }
    ]);

    useEffect(() => {
        fetchChatOrder();
    }, []);

    const fetchChatOrder = async () => {
        try {
            const response = await client.get(`/chat-order/${orderId}`);
            if (response.data.products && response.data.products.length > 0) {
                // Ensure values are strings for TextInput
                const normalizedProducts = response.data.products.map(p => ({
                    ...p,
                    quantity: String(p.quantity || 1),
                    price: String(p.price || 0),
                    discount: String(p.discount || 0)
                }));
                setProducts(normalizedProducts);
            }
        } catch (error) {
            console.error('Error fetching order:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleProductChange = (index, field, value) => {
        const updatedProducts = [...products];
        updatedProducts[index][field] = value;

        if (field === 'price' || field === 'discount' || field === 'quantity') {
            const price = parseFloat(updatedProducts[index].price) || 0;
            const discount = parseFloat(updatedProducts[index].discount) || 0;
            const quantity = parseInt(updatedProducts[index].quantity) || 0;
            updatedProducts[index].totalAmount = (price * quantity * (1 - discount / 100)).toFixed(2);
        }
        setProducts(updatedProducts);
    };

    const addProduct = () => {
        setProducts([...products, { name: '', quantity: '1', price: '0', discount: '0', totalAmount: 0 }]);
    };

    const removeProduct = (index) => {
        if (products.length > 1) {
            setProducts(products.filter((_, i) => i !== index));
        } else {
            setProducts([{ name: '', quantity: '1', price: '0', discount: '0', totalAmount: 0 }]);
        }
    };

    const handleSave = async () => {
        // Validation
        const isValid = products.every(p => p.name.trim() !== '' && parseFloat(p.price) >= 0);
        if (!isValid) {
            Alert.alert('Error', 'Please fill in all product names and valid prices.');
            return;
        }

        try {
            setSubmitting(true);
            const response = await client.put('/chat/updateChatOrder', {
                orderId,
                products: products.map(p => ({
                    ...p,
                    quantity: parseInt(p.quantity),
                    price: parseFloat(p.price),
                    discount: parseFloat(p.discount)
                })),
            });
            Alert.alert('Success', 'Order updated successfully!');
            navigation.goBack();
        } catch (error) {
            console.error('Error updating order:', error);
            Alert.alert('Error', 'Failed to update order. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#ff6600" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.headerCard}>
                    <Text style={styles.headerLabel}>Message from Customer:</Text>
                    <Text style={styles.headerMsg}>{orderMsg}</Text>
                </View>

                {products.map((product, index) => (
                    <View key={index} style={styles.productCard}>
                        <View style={styles.productHeader}>
                            <Text style={styles.productTitle}>Product {index + 1}</Text>
                            <TouchableOpacity onPress={() => removeProduct(index)}>
                                <Icon name="delete-outline" size={24} color="#FF3B30" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.inputLabel}>Product Name</Text>
                        <TextInput
                            style={styles.input}
                            value={product.name}
                            onChangeText={(val) => handleProductChange(index, 'name', val)}
                            placeholder="Enter product name"
                        />

                        <View style={styles.row}>
                            <View style={styles.flex1}>
                                <Text style={styles.inputLabel}>Price</Text>
                                <TextInput
                                    style={styles.input}
                                    value={product.price}
                                    onChangeText={(val) => handleProductChange(index, 'price', val)}
                                    keyboardType="numeric"
                                    placeholder="0"
                                />
                            </View>
                            <View style={[styles.flex1, { marginLeft: 10 }]}>
                                <Text style={styles.inputLabel}>Qty</Text>
                                <TextInput
                                    style={styles.input}
                                    value={product.quantity}
                                    onChangeText={(val) => handleProductChange(index, 'quantity', val)}
                                    keyboardType="numeric"
                                    placeholder="1"
                                />
                            </View>
                        </View>

                        <View style={styles.row}>
                            <View style={styles.flex1}>
                                <Text style={styles.inputLabel}>Discount %</Text>
                                <TextInput
                                    style={styles.input}
                                    value={product.discount}
                                    onChangeText={(val) => handleProductChange(index, 'discount', val)}
                                    keyboardType="numeric"
                                    placeholder="0"
                                />
                            </View>
                            <View style={[styles.flex1, { marginLeft: 10, justifyContent: 'center' }]}>
                                <Text style={styles.totalLabel}>Subtotal</Text>
                                <Text style={styles.totalValue}>₹{product.totalAmount}</Text>
                            </View>
                        </View>
                    </View>
                ))}

                <TouchableOpacity style={styles.addButton} onPress={addProduct}>
                    <Icon name="plus" size={20} color="#ff6600" />
                    <Text style={styles.addButtonText}>Add Product</Text>
                </TouchableOpacity>

                <View style={styles.totalCard}>
                    <Text style={styles.grandTotalLabel}>Grand Total:</Text>
                    <Text style={styles.grandTotalValue}>
                        ₹{products.reduce((acc, curr) => acc + parseFloat(curr.totalAmount || 0), 0).toFixed(2)}
                    </Text>
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.saveButton, submitting && styles.disabledButton]}
                    onPress={handleSave}
                    disabled={submitting}
                >
                    {submitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.saveButtonText}>Save Changes</Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 100,
    },
    headerCard: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 16,
        marginBottom: 20,
        borderLeftWidth: 4,
        borderLeftColor: '#ff6600',
    },
    headerLabel: {
        fontSize: 12,
        color: '#8E8E93',
        marginBottom: 4,
        fontWeight: '600',
    },
    headerMsg: {
        fontSize: 16,
        color: '#1A1A1A',
        lineHeight: 22,
    },
    productCard: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 16,
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    productHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F2F2F7',
        paddingBottom: 8,
    },
    productTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#ff6600',
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#444',
        marginBottom: 6,
    },
    input: {
        backgroundColor: '#F2F2F7',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 14,
        color: '#1A1A1A',
        marginBottom: 14,
    },
    row: {
        flexDirection: 'row',
    },
    flex1: {
        flex: 1,
    },
    totalLabel: {
        fontSize: 12,
        color: '#8E8E93',
        marginBottom: 2,
        textAlign: 'right',
    },
    totalValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1A1A1A',
        textAlign: 'right',
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#ff6600',
        borderStyle: 'dashed',
        marginBottom: 20,
    },
    addButtonText: {
        color: '#ff6600',
        fontWeight: '700',
        marginLeft: 8,
    },
    totalCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#1A1A1A',
        padding: 20,
        borderRadius: 16,
    },
    grandTotalLabel: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    grandTotalValue: {
        color: '#ff6600',
        fontSize: 24,
        fontWeight: '800',
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#F2F2F7',
    },
    saveButton: {
        backgroundColor: '#ff6600',
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#ff6600',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    disabledButton: {
        opacity: 0.7,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
});

export default CreateChatOrderScreen;
