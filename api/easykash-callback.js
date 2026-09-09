const crypto = require('crypto');

const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL || 'https://date-c74fc-default-rtdb.firebaseio.com';
const EASYKASH_HMAC_SECRET = process.env.EASYKASH_HMAC_SECRET || null;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || null;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || null;

let admin = null;
try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const fbAdmin = require('firebase-admin');
        if (!fbAdmin.apps.length) {
            fbAdmin.initializeApp({
                credential: fbAdmin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
                databaseURL: FIREBASE_DB_URL
            });
        }
        admin = fbAdmin;
    }
} catch (e) { console.error('firebase-admin init failed (optional):', e.message || e); }

async function confirmOrderServerSide(customerReference, paymentMethod, voucher, easykashRef, status) {
    if (!admin) return false;
    try {
        const ref = `orders/${String(customerReference).replace(/[^0-9a-zA-Z_-]/g, '_')}`;
        const snap = await admin.database().ref(ref).once('value');
        if (!snap.exists()) return false;
        const existing = snap.val();
        if (existing.status === 'confirmed' || existing.status === 'rejected' || existing.status === 'trashed') return true;
        await admin.database().ref(ref).update({
            status: 'confirmed',
            confirmedAt: Date.now(),
            paymentConfirmed: true,
            paidVia: 'easykash',
            easykashStatus: status,
            easykashPaymentMethod: paymentMethod || existing.easykashPaymentMethod || '',
            easykashVoucher: voucher || '',
            easykashTxnRef: easykashRef || ''
        });
        return true;
    } catch (e) {
        console.error('Server auto-confirm failed:', e);
        return false;
    }
}

function verifySignature(rawBody, signatureHeader) {
    if (!EASYKASH_HMAC_SECRET) return { ok: true, reason: 'no-secret-configured' };
    if (!signatureHeader) return { ok: false, reason: 'missing-signature' };
    try {
        const expected = crypto.createHmac('sha256', EASYKASH_HMAC_SECRET).update(rawBody).digest('hex');
        const provided = signatureHeader;
        return { ok: expected === provided, reason: expected === provided ? 'ok' : 'mismatch' };
    } catch (e) {
        return { ok: false, reason: 'error' };
    }
}

async function writeInbox(customerReference, payload) {
    const path = `meta/easykashPayments/${String(customerReference).replace(/[^0-9a-zA-Z_-]/g, '_')}.json`;
    const res = await fetch(`${FIREBASE_DB_URL}/${path}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...payload,
            receivedAt: Date.now()
        })
    });
    if (!res.ok) {
        throw new Error('Failed to write inbox: ' + res.status + ' ' + await res.text());
    }
}

function sendTelegram(message) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
    fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'HTML'
        })
    }).catch(() => {});
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-easykash-signature, x-pay-signature, signature');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const b = req.body || {};
    // EasyKash sends the signature INSIDE the body as `signatureHash` (docs), not as a header.
    const signature = b.signatureHash || req.headers['x-easykash-signature'] || req.headers['x-pay-signature'] || req.headers['signature'] || null;
    // Compute the hash over the payload WITHOUT the signatureHash field itself.
    const bodyForSig = (() => {
        try {
            const copy = JSON.parse(JSON.stringify(b));
            delete copy.signatureHash;
            return JSON.stringify(copy);
        } catch (e) { return JSON.stringify(b); }
    })();

    const sigResult = verifySignature(bodyForSig, signature);
    if (!sigResult.ok) {
        return res.status(400).json({ error: 'Invalid signature', reason: sigResult.reason });
    }

    const customerReference = b.customerReference;
    const status = (b.status || '').toUpperCase();
    const easykashRef = b.easykashRef || '';
    const paymentMethod = b.PaymentMethod || b.paymentMethod || '';
    const amount = b.Amount || b.amount || '';
    const buyerName = b.BuyerName || b.name || '';
    const voucher = b.voucher || '';

    if (customerReference === undefined || customerReference === null || customerReference === '') {
        return res.status(400).json({ error: 'Missing customerReference' });
    }

    try {
        await writeInbox(customerReference, {
            status: status,
            easykashRef: easykashRef,
            paymentMethod: paymentMethod,
            amount: amount,
            buyerName: buyerName,
            voucher: voucher,
            productCode: b.ProductCode || '',
            raw: b
        });

        if (status === 'PAID') {
            // Server-side auto-confirm requires BOTH firebase-admin AND HMAC signature verification — otherwise any
            // forged webhook could confirm unpaid orders. Falls back to inbox + admin-panel auto-confirm when HMAC is off.
            const confirmedServer = (EASYKASH_HMAC_SECRET && admin) ? await confirmOrderServerSide(customerReference, paymentMethod, voucher, easykashRef, status) : false;
            sendTelegram(
                `✅ <b>دفع إلكتروني ناجح (EasyKash)</b>\n` +
                `━━━━━━━━━━━━━\n` +
                `🔢 <b>المرجع:</b> ${String(customerReference)}\n` +
                `💰 <b>المبلغ:</b> ${amount}\n` +
                `💳 <b>الطريقة:</b> ${paymentMethod || 'N/A'}\n` +
                `👤 <b>العميل:</b> ${buyerName || 'N/A'}\n` +
                `🧾 <b>مرجع المعاملة:</b> ${easykashRef || 'N/A'}\n` +
                (confirmedServer ? `✅ <b>تم تأكيد الطلب تلقائياً (خادمياً)</b>` : `⚠️ <b>بانتظار أدمن لتأكيد الطلب</b> (السجل في صندوق الاستقبال)`) +
                (!EASYKASH_HMAC_SECRET ? `\n⚠️ <b>تنبيه أمني:</b> HMAC غير مفعّل — يجب تفعيله من لوحة EasyKash` : '')
            );
        }

        return res.status(200).json({ ok: true });
    } catch (e) {
        console.error('EasyKash callback error:', e);
        return res.status(500).json({ error: e.message || 'Internal error' });
    }
};