const XPAY_API_KEY = process.env.EASYKASH_API_KEY || 'kw2ush1wj4i9pis6';
const XPAY_API_URL = 'https://back.easykash.net/api/directpayv1/pay';

// EasyKash payment option codes
const PAYMENT_OPTIONS_MAP = {
    cards: 2, // Credit & Debit Card
    wallets: 4, // Mobile Wallet
    cash: 5, // Cash Through Fawry
    aman: 1, // Cash Through AMAN
    meeza: 6, // Meeza
    qassatly: 3, // Qassatly
    nbe6: 8, // 6 Months - NBE
    nbe12: 9, // 12 Months - NBE
    nbe18: 10, // 18 Months - NBE
    valu: 17, // ValU
    amanInstallments: 21, // Aman Installments
    souhoola: 22, // Souhoula
    contact: 23, // Contact
    mogo: 24, // Mogo/MidTakseet
    halan: 29, // Halan
    applePay: 31, // Apple Pay
    tru: 32, // TRU
    klivvr: 33, // Klivvr
    forsaa: 34, // Forsa
    payByCard: 35 // Pay by Card
};

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { amount, currency, customerName, customerEmail, customerPhone, orderId, productTitle, paymentOptions } = req.body;

        // Validate required fields
        if (!amount || !customerName || !customerEmail || !customerPhone) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (parseFloat(amount) < 1) {
            return res.status(400).json({ error: 'Amount must be at least 1' });
        }

        // Build redirect URL dynamically from request headers
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const host = req.headers['host'] || req.headers['x-forwarded-host'];
        const baseUrl = `${protocol}://${host}`;
        const redirectUrl = `${baseUrl}/pending-order?ref=${orderId || ''}&source=easykash`;

        // Build payment options array
        const selectedOptions = paymentOptions && paymentOptions.length > 0
            ? paymentOptions.map(opt => PAYMENT_OPTIONS_MAP[opt] || parseInt(opt)).filter(n => !isNaN(n))
            : [2, 4, 5, 6, 1, 8, 9, 10, 17, 21, 22, 23, 31, 32, 33];

        // EasyKash API request body
        const body = {
            amount: parseFloat(amount),
            currency: currency || 'EGP',
            paymentOptions: selectedOptions,
            cashExpiry: 3,
            name: customerName,
            email: customerEmail,
            mobile: customerPhone,
            redirectUrl: redirectUrl,
            customerReference: orderId ? parseInt(String(orderId).replace(/\D/g, '').slice(0, 10)) || Date.now() : Date.now()
        };

        const response = await fetch(XPAY_API_URL, {
            method: 'POST',
            headers: {
                'authorization': XPAY_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (data.redirectUrl) {
            return res.status(200).json({
                redirectUrl: data.redirectUrl,
                customerReference: body.customerReference
            });
        }

        console.error('EasyKash API error:', data);
        return res.status(400).json({ error: data.message || data.error || 'Failed to create payment session', details: data });
    } catch (error) {
        console.error('EasyKash session error:', error);
        return res.status(500).json({ error: 'Internal server error: ' + error.message });
    }
};
