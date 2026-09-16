(function(){
    var DEFAULT_STORE = {
        email: 'bravoenergyeg@gmail.com',
        phone: '+20 101 285 3829',
        whatsapp: '201012853829'
    };

    window.POLICY_DATA = {
        lastUpdated: { ar: '16 سبتمبر 2026', en: 'September 16, 2026', fr: '16 septembre 2026' },
        refundWindow: null,
        reviewTime: null,
        deliveryTime: null
    };

    function currentLang(){
        return (document.documentElement.lang || 'ar').toLowerCase();
    }

    function applyPolicyData(){
        var lang = currentLang();
        document.querySelectorAll('[data-policy]').forEach(function(el){
            var key = el.getAttribute('data-policy');
            var p = window.POLICY_DATA[key];
            var v = p;
            if (p && typeof p === 'object' && !Array.isArray(p)) v = p[lang] || p.ar || p.en || p.fr || '';
            if (v === null || v === undefined || v === '') {
                if (el.hasAttribute('data-optional')) {
                    var wrap = el.closest('.policy-dynamic') || el;
                    wrap.parentNode.removeChild(wrap);
                } else {
                    el.textContent = '';
                }
                return;
            }
            el.textContent = v;
        });
    }

    function toWaNumber(phone){
        var d = String(phone || '').replace(/\D/g, '');
        if (d.length >= 10 && d.charAt(0) === '0') d = '20' + d.slice(1);
        return d;
    }

    function applyStoreInfo(store){
        var email = store && store.email ? store.email : DEFAULT_STORE.email;
        var phone = store && store.phone ? store.phone : DEFAULT_STORE.phone;
        var wa = toWaNumber(phone);
        document.querySelectorAll('[data-store-email]').forEach(function(el){
            el.textContent = email;
            el.href = 'mailto:' + email;
        });
        document.querySelectorAll('[data-store-phone]').forEach(function(el){
            el.textContent = phone;
        });
        document.querySelectorAll('[data-store-wa]').forEach(function(el){
            el.href = 'https://wa.me/' + wa + '?text=' + encodeURIComponent('سلام عليكم، لدي استفسار بخصوص سياسات المتجر') ;
        });
    }

    function fillFromStore(){
        var started = Date.now();
        (function poll(){
            try {
                if (typeof DB !== 'undefined' && DB && typeof DB.get === 'function') {
                    DB.get('settings/store').then(function(d){ applyStoreInfo(d); }).catch(function(){ applyStoreInfo(null); });
                    return;
                }
            } catch(e){}
            if (Date.now() - started < 6000) {
                setTimeout(poll, 400);
            } else {
                applyStoreInfo(null);
            }
        })();
    }

    window.applyPolicyData = applyPolicyData;
    window.POLICY_DATA._resolve = currentLang;

    var btns = document.querySelectorAll('.back-to-top');
    if (btns.length) {
        var btn = btns[0];
        btn.addEventListener('click', function(e){
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        var onScroll = function(){
            var show = window.scrollY > 500;
            btn.classList.toggle('show', show);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }

    if (window.MutationObserver && document.documentElement) {
        new MutationObserver(function(){ applyPolicyData(); }).observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['lang']
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function(){
            applyPolicyData();
            fillFromStore();
        });
    } else {
        applyPolicyData();
        fillFromStore();
    }
})();