export const formatPrice = (amount) => {
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount)) return '₹0';
    return `₹${Math.round(numericAmount)}`;
};
