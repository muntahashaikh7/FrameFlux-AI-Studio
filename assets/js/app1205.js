// Forge SaaS — client-side helpers (no framework)
(() => {
    // Keep off-screen gallery media out of the initial network waterfall.
    const galleryMediaObserver = 'IntersectionObserver' in window
        ? new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                loadGalleryMedia(entry.target);
                galleryMediaObserver.unobserve(entry.target);
            });
        }, { rootMargin: '600px 0px' })
        : null;

    function loadGalleryMedia(media, activateVideo = false) {
        if (!media) return;
        const src = media.dataset.mediaSrc;
        const poster = media.dataset.posterSrc;
        if (media.tagName === 'VIDEO' && !activateVideo) {
            if (poster && !media.poster) media.poster = poster;
            delete media.dataset.posterSrc;
            return;
        }
        if (poster && !media.poster) media.poster = poster;
        if (src && !media.getAttribute('src')) {
            media.src = src;
            if (media.tagName === 'VIDEO') media.load();
        }
        if (media.tagName === 'IMG') {
            media.loading = 'lazy';
            media.decoding = 'async';
        }
        delete media.dataset.mediaSrc;
        delete media.dataset.posterSrc;
    }

    function observeGalleryMedia(root = document) {
        root.querySelectorAll?.('video[data-media-src], img[data-media-src]').forEach((media) => {
            if (galleryMediaObserver) galleryMediaObserver.observe(media);
            else loadGalleryMedia(media);
        });
    }

    observeGalleryMedia();

    function jobAspectClass(aspect) {
        return aspect === '9:16' ? 'job-ratio-portrait'
            : (aspect === '16:9' ? 'job-ratio-landscape' : 'job-ratio-square');
    }

    function jobVideoMarkup(media, poster, aspect) {
        return `<div class="job-video-shell ${jobAspectClass(aspect)}">
            <video src="${media}" poster="${poster}" preload="auto" controls playsinline controlsList="nodownload" oncontextmenu="return false;"></video>
            <button class="job-video-play" type="button" aria-label="Play video" title="Play video">
                <svg class="job-video-play-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.2v13.6a1 1 0 0 0 1.52.86l10.3-6.8a1.03 1.03 0 0 0 0-1.72L9.52 4.34A1 1 0 0 0 8 5.2Z"></path></svg>
                <svg class="job-video-pause-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"></path></svg>
            </button>
            <span class="job-video-loading" aria-hidden="true"></span>
        </div>`;
    }

    function enhanceJobVideoPlayers(root = document) {
        root.querySelectorAll?.('.job-video-shell video').forEach((video) => {
            if (video.dataset.jobPlayerReady === '1') return;
            video.dataset.jobPlayerReady = '1';
            const shell = video.closest('.job-video-shell');
            const button = shell?.querySelector('.job-video-play');
            const setPlaying = (playing) => {
                shell?.classList.toggle('is-playing', playing);
                if (button) {
                    button.setAttribute('aria-label', playing ? 'Pause video' : 'Play video');
                    button.title = playing ? 'Pause video' : 'Play video';
                }
            };
            const setLoading = (loading) => shell?.classList.toggle('is-loading', loading);
            button?.addEventListener('click', (event) => {
                event.preventDefault();
                if (video.paused) video.play().catch(() => setPlaying(false));
                else video.pause();
            });
            video.addEventListener('click', () => {
                if (video.paused) video.play().catch(() => setPlaying(false));
                else video.pause();
            });
            video.addEventListener('play', () => setPlaying(true));
            video.addEventListener('pause', () => setPlaying(false));
            video.addEventListener('waiting', () => setLoading(true));
            video.addEventListener('stalled', () => setLoading(true));
            video.addEventListener('canplay', () => setLoading(false));
            video.addEventListener('playing', () => setLoading(false));
            video.addEventListener('error', () => setLoading(false));
            setPlaying(!video.paused);
        });
    }

    enhanceJobVideoPlayers();

    // Job polling: any element with data-poll-job="<apiJobId>" gets polled and rendered.
    // We always render results through /media.php?id=<localId> so the browser never
    // sees the raw Pixverse/OSS URL or filename.
    async function pollJob(el) {
        const id = el.dataset.pollJob;
        if (!id) return;
        const localId = el.dataset.jobLocalId || el.dataset.localId;
        try {
            const r  = await fetch(`/api/job_status.php?id=${encodeURIComponent(id)}`, { credentials: 'same-origin' });
            const d  = await r.json();
            if (!d || !d.ok) return;
            const status = d.job.status;
            const badge = el.querySelector('[data-job-status]');
            if (badge) badge.textContent = status;
            if (status === 'completed') {
                const preview = el.querySelector('[data-job-preview]');
                if (preview && localId) {
                    const media = `/media.php?id=${encodeURIComponent(localId)}`;
                    const poster = `/media.php?id=${encodeURIComponent(localId)}&thumb=1`;
                    preview.innerHTML = d.job.kind === 'video'
                        ? jobVideoMarkup(media, poster, d.job.aspect_ratio || el.dataset.jobAspect || '')
                        : `<img src="${media}" decoding="async" alt="" oncontextmenu="return false;">`;
                    enhanceJobVideoPlayers(preview);
                }
                el.classList.add('done');
                // reveal any hidden download button
                const dl = el.closest('.grid')?.querySelector('[data-dl-btn]');
                if (dl && localId) { dl.href = `/media.php?id=${encodeURIComponent(localId)}&dl=1`; dl.classList.remove('hidden'); }
            } else if (status === 'failed') {
                el.classList.add('failed');
                const em = el.querySelector('[data-job-error]');
                if (em) em.textContent = d.job.error_msg || 'Generation failed.';
            } else {
                setTimeout(() => pollJob(el), 2500);
            }
        } catch (e) {
            setTimeout(() => pollJob(el), 5000);
        }
    }
    document.querySelectorAll('[data-poll-job]').forEach(pollJob);

    // Global function to update quota counters dynamically across the UI
    window.updateDynamicQuotaUI = function(q) {
        if (!q) return;
        const updateQuotaCopies = (className, value) => {
            if (value == null) return;
            document.querySelectorAll(`.${className}`).forEach(el => { el.textContent = value; });
        };
        updateQuotaCopies('headerVideo8Left', q.video_8s_remaining);
        updateQuotaCopies('headerVideo15Left', q.video_15s_remaining);
        updateQuotaCopies('headerImageLeft', q.image_remaining);

        // Sidebar widget update
        const sbLine = document.querySelector('.pw-line strong');
        if (sbLine) sbLine.textContent = `${q.video_used}/${q.video_limit}`;
        const sbFill = document.querySelector('.pw-bar .fill');
        if (sbFill) {
            const pct = Math.min(100, Math.round((q.video_used / Math.max(1, q.video_limit)) * 100));
            sbFill.style.width = pct + '%';
        }

        // Studio Quota Strip Widget updates
        const qvVal = document.getElementById('quotaVideoVal');
        if (qvVal) qvVal.textContent = `${q.video_used} / ${q.video_limit}`;
        const qvRing = document.getElementById('quotaVideoRing');
        if (qvRing) {
            const pct = Math.min(100, Math.round((q.video_used / Math.max(1, q.video_limit)) * 100));
            qvRing.style.setProperty('--pct', pct);
        }

        const qpVal = document.getElementById('quotaProgressVal');
        if (qpVal) qpVal.textContent = `${q.active} / ${q.cap}`;
        const qpRing = document.getElementById('quotaProgressRing');
        if (qpRing) {
            const pct = Math.min(100, Math.round((q.active / Math.max(1, q.cap)) * 100));
            qpRing.style.setProperty('--pct', pct);
        }

        const qiVal = document.getElementById('quotaImageVal');
        if (qiVal) qiVal.textContent = `${q.image_used} / ${q.image_limit}`;
        const qiRing = document.getElementById('quotaImageRing');
        if (qiRing) {
            const pct = Math.min(100, Math.round((q.image_used / Math.max(1, q.image_limit)) * 100));
            qiRing.style.setProperty('--pct', pct);
        }

        // Generic elements
        document.querySelectorAll('[data-quota-v-used]').forEach(el => el.textContent = q.video_used);
        document.querySelectorAll('[data-quota-v-limit]').forEach(el => el.textContent = q.video_limit);
        document.querySelectorAll('[data-quota-i-used]').forEach(el => el.textContent = q.image_used);
        document.querySelectorAll('[data-quota-i-limit]').forEach(el => el.textContent = q.image_limit);
    };

    // Gallery & Quota auto-refresh
    (function galleryAutoSync() {
        const grid = document.querySelector('[data-gallery-sync]') || document.body;
        let activeTick = false;
        async function tick() {
            const pending = document.querySelectorAll('.gallery-item[data-pending="1"]');
            if (pending.length === 0 && !document.querySelector('[data-gallery-sync]')) {
                activeTick = false;
                return;
            }
            activeTick = true;
            try {
                const r = await fetch('https://veoframe.com/api/jobs_sync.php', { credentials: 'same-origin' });
                const d = await r.json();
                if (d && d.ok) {
                    if (d.quota) {
                        window.updateDynamicQuotaUI(d.quota);
                        // Keep Studio submission capacity aligned with the authoritative DB count.
                        if (typeof window.updatePromptCapacity === 'function') {
                            window.updatePromptCapacity(d.quota.active, d.quota.cap);
                        }
                    }
                    if (Array.isArray(d.jobs)) {
                        d.jobs.forEach((j) => {
                            const tiles = document.querySelectorAll(`.gallery-item[data-job-id="${j.id}"]`);
                            if (tiles.length === 0) return;
                            tiles.forEach(tile => {
                                const tag = tile.querySelector('.status-tag');
                                if (tag) {
                                    if (j.status === 'completed' || j.status === 'failed') {
                                        tag.innerHTML = '';
                                    } else {
                                        tag.innerHTML = `<span class="badge badge-${j.status}">${j.status}</span>`;
                                    }
                                }
                                if (j.status === 'completed') {
                                    tile.dataset.pending = '0';
                                    const existingImg = tile.querySelector('img');
                                    const existingVid = tile.querySelector('video');

                                    // DO NOT remove or recreate existing media elements - this prevents video blinking!
                                    if ((j.kind === 'video' && existingVid) || (j.kind === 'image' && existingImg)) {
                                        return;
                                    }

                                    const media = `/media.php?id=${encodeURIComponent(j.id)}`;
                                    const thumbMedia = `/media.php?id=${encodeURIComponent(j.id)}&thumb=1`;
                                    
                                    const existingDiv = tile.querySelector('div:not(.status-tag):not(.overlay)');
                                    if (existingImg) existingImg.remove();
                                    if (existingVid) existingVid.remove();
                                    if (existingDiv) existingDiv.remove();
                                    
                                    let el;
                                    if (j.kind === 'video') {
                                        el = document.createElement('video');
                                        el.dataset.mediaSrc = media;
                                        el.dataset.posterSrc = thumbMedia;
                                        el.loop = true;
                                        el.muted = true;
                                        el.playsInline = true;
                                        el.preload = 'none';
                                        el.style.width = '100%';
                                        el.style.height = '100%';
                                        el.style.objectFit = 'cover';
                                        el.style.borderRadius = '10px';
                                        el.setAttribute('oncontextmenu', 'return false;');
                                    } else {
                                        el = document.createElement('img');
                                        el.dataset.mediaSrc = thumbMedia;
                                        el.loading = 'lazy';
                                        el.decoding = 'async';
                                        el.style.width = '100%';
                                        el.style.height = '100%';
                                        el.style.objectFit = 'cover';
                                        el.style.borderRadius = '10px';
                                        el.setAttribute('oncontextmenu', 'return false;');
                                    }
                                    tile.prepend(el);
                                    observeGalleryMedia(tile);
                                } else if (j.status === 'failed') {
                                    tile.dataset.pending = '0';
                                    const existingDiv = tile.querySelector('.card-pending-wrapper, div:not(.status-tag):not(.overlay)');
                                    if (existingDiv) {
                                        // Show specific prompt error if provided, otherwise generic message with quota refunded notice
                                        let dispErr = (j.error_msg && j.error_msg.trim()) ? j.error_msg : (j.kind === 'image' ? 'Image generation failed. Quota refunded.' : 'Video generation failed. Quota refunded.');
                                        if (!dispErr.includes('Quota refunded')) dispErr += ' Quota refunded.';

                                        // Replace with plain static failed state (no glow, no animation)
                                        existingDiv.style.cssText = 'display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; background:#111218; border-radius:12px; padding:12px; text-align:center; animation:none; border:none; box-shadow:none;';
                                        existingDiv.innerHTML = `
                                            <div class="card-failed-state">
                                                <svg class="error-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                    <circle cx="12" cy="12" r="10"></circle>
                                                    <line x1="15" y1="9" x2="9" y2="15"></line>
                                                    <line x1="9" y1="9" x2="15" y2="15"></line>
                                                </svg>
                                                <span class="error-msg">${escapeHtml(dispErr)}</span>
                                            </div>
                                        `;
                                    }
                                } else if (j.status === 'queued' || j.status === 'processing') {
                                    const loadingMsg = tile.querySelector('.loading-msg');
                                    if (loadingMsg) {
                                        const actionText = j.kind === 'image' ? 'Generating' : 'Rendering';
                                        const pct = (j.progress && j.progress > 0) ? ` ${j.progress}%` : '';
                                        loadingMsg.textContent = j.status === 'processing' ? `${actionText}${pct}...` : 'Queued...';
                                    }
                                }
                            });
                        });
                    }
                }
            } catch (e) { /* ignore, retry next tick */ }
            const hasPending = document.querySelector('.gallery-item[data-pending="1"]');
            setTimeout(tick, hasPending ? 1500 : 4000);
        }
        window.triggerGallerySync = () => {
            if (!activeTick) {
                setTimeout(tick, 100);
            }
        };
        setTimeout(tick, 1000);

        // Hover-to-play videos in gallery
        document.addEventListener('mouseover', (e) => {
            const item = e.target.closest('.gallery-item');
            if (item) {
                const vid = item.querySelector('video');
                if (vid && vid.paused) {
                    loadGalleryMedia(vid, true);
                    vid.play().catch(() => {});
                }
            }
        });
        document.addEventListener('mouseout', (e) => {
            const item = e.target.closest('.gallery-item');
            if (item) {
                const vid = item.querySelector('video');
                if (vid && !vid.paused) {
                    vid.pause();
                    vid.currentTime = 0;
                }
            }
        });
    })();

    // Confirm buttons
    document.querySelectorAll('[data-confirm]').forEach((el) => {
        el.addEventListener('click', (e) => {
            if (!confirm(el.dataset.confirm)) e.preventDefault();
        });
    });

    // Modal openers
    document.querySelectorAll('[data-modal-open]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const sel = btn.dataset.modalOpen;
            const el  = document.querySelector(sel);
            if (el) el.classList.remove('hidden');
        });
    });
    document.querySelectorAll('[data-modal-close]').forEach((btn) => {
        btn.addEventListener('click', () => btn.closest('.modal-back')?.classList.add('hidden'));
    });
    document.querySelectorAll('.modal-back').forEach((back) => {
        back.addEventListener('click', (e) => { if (e.target === back) back.classList.add('hidden'); });
    });


    // ======================================================================
    // Support widget (floating chat panel)
    // ======================================================================
    const fab = document.getElementById('supportFab');
    const panel = document.getElementById('supportPanel');
    const panelBody = document.getElementById('supportPanelBody');
    const closeBtn = document.getElementById('supportClose');
    if (fab && panel) {
        let loaded = false;
        async function loadTickets() {
            try {
                const r = await fetch('https://veoframe.com/api/support_widget.php', { credentials: 'same-origin' });
                const d = await r.json();
                if (!d || !d.ok) throw new Error('Failed');
                if (!Array.isArray(d.tickets) || d.tickets.length === 0) {
                    panelBody.innerHTML = `<div class="tc muted" style="padding:24px 12px">
                        <div style="font-size:2rem;opacity:.35">💬</div>
                        <p>No tickets yet.<br>Have a question? Open a new one.</p>
                    </div>`;
                    return;
                }
                panelBody.innerHTML = d.tickets.map(t => `
                    <a href="/user/ticket.php?id=${t.id}" class="sp-ticket ${t.unread ? 'unread' : ''}">
                        <div class="sp-t-title">${escapeHtml(t.subject)}</div>
                        <div class="sp-t-meta">
                            <span class="badge badge-${t.status_class}">${t.status}</span>
                            · ${t.ago}
                        </div>
                    </a>
                `).join('');
            } catch (e) {
                panelBody.innerHTML = `<div class="tc muted">Could not load tickets.</div>`;
            }
        }
        fab.addEventListener('click', () => {
            panel.classList.toggle('open');
            if (!loaded && panel.classList.contains('open')) { loaded = true; loadTickets(); }
        });
        if (closeBtn) closeBtn.addEventListener('click', () => panel.classList.remove('open'));
    }

    function escapeHtml(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        }[c]));
    }

    // ======================================================================
    // Toggle switches (admin models etc)
    // Every <label class="toggle"> with an inner checkbox self-syncs its knob.
    // ======================================================================
    document.querySelectorAll('.toggle input[type="checkbox"]').forEach(inp => {
        const upd = () => inp.closest('.toggle')?.classList.toggle('on', inp.checked);
        upd();
        inp.addEventListener('change', upd);
    });

    // ======================================================================
    // Studio: wire EACH form independently.
    // The previous version used document.querySelector for the model/quality
    // groups, which only ever matched the first (image) form — so the video
    // form's quality & aspect never built and its hidden fields stayed empty,
    // triggering "Missing required fields" on submit. We now scope every
    // lookup to the form the control lives in.
    // ======================================================================
    const MODELS = window.FORGE_MODELS || [];

    function fillGroup(group, items, builder) {
        // Look up the hidden input by name at the form level — the hidden
        // inputs are siblings of the ctl-rows, not children.
        const fieldName = group.dataset.radioGroup;
        const form = group.closest('form');
        const hidden = form && fieldName
            ? form.querySelector('input[type="hidden"][name="' + fieldName + '"]')
            : null;
        group.innerHTML = items.map(builder).join('');
        const opts = group.querySelectorAll('.chip, .aspect-opt');
        opts.forEach(opt => opt.addEventListener('click', () => {
            opts.forEach(x => x.classList.remove('on'));
            opt.classList.add('on');
            if (hidden) hidden.value = opt.dataset.value;
        }));
        const first = group.querySelector('.chip, .aspect-opt');
        if (first) first.click();
    }

    document.querySelectorAll('form[data-studio-form]').forEach(form => {
        const modelGroup = form.querySelector('[data-radio-group="model"]');
        const qGroup     = form.querySelector('[data-radio-group="quality"]');
        const aGroup     = form.querySelector('[data-radio-group="aspect_ratio"]');
        const modelHidden = form.querySelector('input[type="hidden"][name="model"]');

        const rebuild = (modelValue) => {
            const m = MODELS.find(x => x.api_name === modelValue);
            if (!m) return;
            if (qGroup) fillGroup(qGroup, (m.qualities || []),
                q => `<label class="chip" data-value="${q}">${q}</label>`);
            let aspects = m.aspects && m.aspects.length ? m.aspects : ['1:1'];
            // Video studio never offers 1:1 (product decision).
            if (m.kind === 'video') aspects = aspects.filter(a => a !== '1:1');
            if (aGroup) fillGroup(aGroup, aspects, a => aspectVisual(a));
        };

        // Model cards
        if (modelGroup) {
            const cards = modelGroup.querySelectorAll('.model-card');
            cards.forEach(card => card.addEventListener('click', () => {
                cards.forEach(x => x.classList.remove('on'));
                card.classList.add('on');
                if (modelHidden) modelHidden.value = card.dataset.value;
                rebuild(card.dataset.value);
            }));
            const on = modelGroup.querySelector('.model-card.on') || cards[0];
            if (on) {
                on.classList.add('on');
                if (modelHidden) modelHidden.value = on.dataset.value;
                rebuild(on.dataset.value);
            }
        }

        // Duration buttons (video only)
        const durGroup = form.querySelector('[data-duration-group]');
        if (durGroup) {
            const durHidden = form.querySelector('input[type="hidden"][name="duration"]');
            const opts = durGroup.querySelectorAll('.chip');
            opts.forEach(opt => opt.addEventListener('click', () => {
                opts.forEach(x => x.classList.remove('on'));
                opt.classList.add('on');
                if (durHidden) durHidden.value = opt.dataset.value;
            }));
        }

        // Prompt idea chips → fill THIS form's textarea only
        form.querySelectorAll('.prompt-ideas .idea').forEach(idea => {
            idea.addEventListener('click', () => {
                const ta = form.querySelector('textarea[name="prompt"]');
                if (ta) { ta.value = idea.dataset.prompt || idea.textContent; ta.focus(); }
            });
        });
    });

    function aspectVisual(a) {
        // draw a small proportional box for each aspect
        const [w, h] = String(a).split(':').map(Number);
        const maxDim = 34;
        const bw = w >= h ? maxDim : Math.round(maxDim * (w/h));
        const bh = h >= w ? maxDim : Math.round(maxDim * (h/w));
        return `<label class="aspect-opt" data-value="${a}">
            <span class="box" style="width:${bw}px;height:${bh}px"></span>
            <span class="lbl">${a}</span>
        </label>`;
    }

    // ======================================================================
    // Studio: drag-drop source image with preview
    // ======================================================================
    document.querySelectorAll('.drop').forEach(drop => {
        const input = drop.querySelector('input[type="file"]');
        const txt   = drop.querySelector('.drop-txt');
        if (!input) return;
        drop.addEventListener('click', () => input.click());
        drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('hasfile'); });
        drop.addEventListener('dragleave', () => drop.classList.remove('hasfile'));
        drop.addEventListener('drop', e => {
            e.preventDefault();
            if (e.dataTransfer.files.length) { input.files = e.dataTransfer.files; input.dispatchEvent(new Event('change')); }
        });
        input.addEventListener('change', () => {
            if (input.files && input.files[0]) {
                drop.classList.add('hasfile');
                if (txt) txt.textContent = input.files[0].name;
            }
        });
    });



    // ======================================================================
    // Mobile nav: hamburger toggle for the public header
    // ======================================================================
    (function mobileNav() {
        const nav    = document.querySelector('[data-nav]');
        const toggle = document.querySelector('[data-nav-toggle]');
        if (!nav || !toggle) return;
        toggle.addEventListener('click', () => {
            const open = nav.classList.toggle('open');
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
        // Close on link click (mobile UX)
        nav.querySelectorAll('.nav-links a').forEach(a => {
            a.addEventListener('click', () => {
                nav.classList.remove('open');
                toggle.setAttribute('aria-expanded', 'false');
            });
        });
    })();

    // ======================================================================
    // Scroll-reveal entrance animations (progressive enhancement)
    //   - Auto-tags common section blocks so existing pages animate with
    //     no markup changes; anything with [data-reveal] is also observed.
    //   - Fully skipped when the user prefers reduced motion.
    // ======================================================================
    (function scrollReveal() {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        // Auto-tag content blocks that benefit from a reveal.
        const autoSel = '.feature-card, .feat, .plan, .price-card, .sec-head, .step, .faq-item, .stat, .hero-showcase';
        document.querySelectorAll(autoSel).forEach(el => {
            if (!el.hasAttribute('data-reveal') && !el.closest('.sidebar, .topbar')) {
                el.setAttribute('data-reveal', '');
            }
        });

        const items = document.querySelectorAll('[data-reveal], [data-reveal-group]');
        if (!items.length) return;

        if (reduce || !('IntersectionObserver' in window)) {
            items.forEach(el => el.classList.add('is-visible'));
            return;
        }
        const io = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    io.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
        items.forEach(el => io.observe(el));
    })();

})();
