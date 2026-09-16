(function(){
    function loadTextSync(path){
        try{
            var xhr = new XMLHttpRequest();
            xhr.open('GET', path, false);
            xhr.overrideMimeType('text/html');
            xhr.send();
            return xhr.status === 0 || (xhr.status >= 200 && xhr.status < 300) ? xhr.responseText : '';
        }catch(e){return '';}
    }

    function getBasePath(){
        var p = location.pathname.replace(/\/[^/]*\.html?$/i, '/');
        if(p === location.pathname + '/') p = location.pathname.replace(/\/+$/, '/');
        if(!p.endsWith('/')) p = p.substring(0, p.lastIndexOf('/') + 1);
        return p;
    }

    function findComponent(filename){
        var t = Date.now();
        var rootPath = '/' + filename + '?v=' + t;
        var relativePath = getBasePath() + filename + '?v=' + t;
        var html = loadTextSync(rootPath);
        if(html) return html;
        html = loadTextSync(relativePath);
        if(html) return html;
        var parts = location.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
        for(var i = parts.length - 1; i >= 0; i--){
            var up = '../'.repeat(parts.length - i - 1) + filename + '?v=' + t;
            html = loadTextSync(up);
            if(html) return html;
        }
        return '';
    }

    var headerHtml = findComponent('components/header.html');
    const currentPage = location.pathname.split('/').pop().replace(/\.html?$/i, '').toLowerCase() || 'index';
    document.body.classList.add('page-' + currentPage);

    const pageMap = {'wishlist':'wishlist.html','cart':'cart.html','checkout':'checkout.html','profile':'profile.html','orders':'orders.html','product-details':'product-details.html'};
    const activeLinkMap = {};
    const matchingPage = pageMap[currentPage];
    const activePage = activeLinkMap[currentPage] || currentPage;

    const isDesktop = window.innerWidth > 992;

    const s = document.createElement('style');
    s.textContent = '@media (min-width: 993px) { .conditional-nav-item { display: none !important; } }';
    if(matchingPage && isDesktop) s.textContent += '.nav-item-' + currentPage + ' { display: inline-block !important; }';
    document.head.appendChild(s);

    function handleConditionalItems(container){
        const items = container.querySelectorAll('.conditional-nav-item');
        if(matchingPage && window.innerWidth > 992){
            let found = false;
            items.forEach(item => {
                if(item.getAttribute('data-page') === matchingPage){
                    item.style.display = '';
                    found = true;
                } else {
                    item.remove();
                }
            });
            if(!found) items.forEach(item => item.remove());
        } else {
            items.forEach(item => item.remove());
        }
    }

    const policyPages = ['terms', 'refund-policy', 'delivery-policy'];

    function applyActive(container){
        if(!container) return;
        const navLinks = container.querySelectorAll('a[role="menuitem"]');
        navLinks.forEach(a => {
            a.classList.remove('active');
            a.removeAttribute('aria-current');
            const href = a.getAttribute('href');
            if(href){
                const hrefPage = href.split('?')[0].replace(/\.html?$/i, '').toLowerCase();
                if(hrefPage && hrefPage !== '#' && !href.startsWith('http') && hrefPage === activePage){
                    a.classList.add('active');
                    a.setAttribute('aria-current', 'page');
                }
            }
        });
    }

    function filterPolicyLinks(container){
        if(!container) return;
        container.querySelectorAll('a[role="menuitem"], .pages-link').forEach(a => {
            const href = a.getAttribute('href');
            if(!href) return;
            
            // حماية العناصر في القائمة الجانبية
            if (a.classList.contains('pages-toggle') || a.closest('.pages-submenu')) return; 

            const hrefPage = href.split('?')[0].replace(/\.html?$/i, '').toLowerCase();
            if(policyPages.indexOf(hrefPage) !== -1){
                if(hrefPage === currentPage) return;
                const li = a.closest('li') || a.parentElement;
                if(li && !li.classList.contains('pages-submenu')) li.remove(); 
            }
        });
    }

    function syncLogoAnimation(){
        try{
            const headerLogo = document.querySelector('.logo-text');
            const footerLogo = document.querySelector('.footer-logo span');
            const els = [headerLogo, footerLogo].filter(Boolean);
            if(els.length < 2) return;
            els.forEach(el => { el.style.animation = 'none'; el.style.backgroundPosition = '0% 50%'; });
            void document.body.offsetWidth;
            els.forEach(el => { el.style.animation = ''; });
        }catch(e){}
    }

    const existingHeader = document.querySelector('header');
    if(existingHeader && headerHtml && headerHtml.indexOf('<header') !== -1){
        const tmp = document.createElement('div');
        tmp.innerHTML = headerHtml;
        const freshHeader = tmp.querySelector('header');
        if(freshHeader){
            existingHeader.outerHTML = headerHtml;
            const newHeader = document.querySelector('header');
            if(newHeader){
                newHeader.style.animation = 'none';
                newHeader.style.visibility = 'visible';
                handleConditionalItems(newHeader);
                filterPolicyLinks(newHeader);
                applyActive(newHeader);
            }
        } else {
            existingHeader.style.visibility = 'visible';
            handleConditionalItems(existingHeader);
            filterPolicyLinks(existingHeader);
            applyActive(existingHeader);
        }
    } else if (existingHeader) {
        existingHeader.style.visibility = 'visible';
        handleConditionalItems(existingHeader);
        filterPolicyLinks(existingHeader);
        applyActive(existingHeader);
    }
    syncLogoAnimation();
})();