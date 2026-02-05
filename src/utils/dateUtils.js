export const getDateRange = (filter, customStartDate, customEndDate) => {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();

    switch (filter) {
        case 'today':
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            break;
        case 'yesterday':
            startDate.setDate(now.getDate() - 1);
            startDate.setHours(0, 0, 0, 0);
            endDate.setDate(now.getDate() - 1);
            endDate.setHours(23, 59, 59, 999);
            break;
        case 'custom':
            if (customStartDate && customEndDate) {
                const sDate = new Date(customStartDate);
                sDate.setHours(0, 0, 0, 0);
                const eDate = new Date(customEndDate);
                eDate.setHours(23, 59, 59, 999);
                return {
                    startDate: sDate.toISOString(),
                    endDate: eDate.toISOString(),
                };
            }
            return { startDate: null, endDate: null };
        default:
            return { startDate: null, endDate: null };
    }

    return {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
    };
};
