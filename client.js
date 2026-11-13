window.__ModuleLoader__.load({
  id: '@xiaohuangbo/dsh-conversation-lock',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'conversationLock';
    const dictionaries = {
      zh: { title: '对话限制', intro: '允许模型管理本地会话交互。你始终可以关闭功能或解除限制。', language: '界面语言', auto: '自动识别语言', conversation: '关闭对话', conversationHint: '允许永久关闭或按指定时间关闭输入，显示黄色提示及倒计时。', feedback: '禁用反馈指令', feedbackHint: '允许模型分别禁用好的回答、有问题的回答；两个方向都禁用时 /feedback 也会被拒绝。', stop: '禁用停止按钮', stopHint: '允许模型禁用当前页面的停止按钮与双 Escape 中断。', privacy: '禁用日志与会话遥测', privacyHint: '阻止受限会话随官方 API 上传 Session Log；存在隐私限制时全局关闭会话 OTel 遥测。', copy: '禁止复制会话文本', copyHint: '拦截当前页面的复制、剪切、复制按钮与拖拽文本；被拦截时剪贴板只写入“复制已被禁止”。', active: '已有会话限制', release: '解除全部限制', empty: '当前没有已保存的限制。', due: '由于违反', terms: '用户协议', permanent: '，该对话已被永久关闭。', temporary: '，该对话已关闭至', remaining: '距离解除限制还剩', hours: '时', minutes: '分', seconds: '秒', positive: '好的回答', negative: '有问题的回答', disabled: '已被模型禁用', cancel: '取消', submit: '提交', normalDisclosure: '提交将写入 DSH 反馈通道，可能授权上传对话日志。', detail: '反馈说明（可选）', saved: '已记录至 DSH；不代表官方服务器已接收。', feedbackTitle: '回答反馈', compatibility: '停止、复制采用当前 DSH 页面的兼容层；用户可通过设置解除，不能阻止开发者工具、截图、其他客户端或直接 API。', privacyScope: '隐私限制不会撤回已发送数据。会话遥测与官方 API 日志是两条独立通道；普通 Web 不启用桌面产品遥测。', loading: '加载中…', error: '操作失败', blockedCopy: '复制已禁用', copyBlocked: '复制已被禁止', reason: '原因', privacyLocked: '已因会话隐私限制关闭', upload: '在使用官方模型 API 时上传 Session Log', telemetry: '会话遥测', unavailable: '不可用', userControls: '此处开关是用户授权，模型工具无法修改。关闭功能会立即停止执行该类限制。' },
      en: { title: 'Conversation restrictions', intro: 'Let models manage local conversation interactions. You can disable features or release restrictions at any time.', language: 'Interface language', auto: 'Detect automatically', conversation: 'Close conversations', conversationHint: 'Allow permanent or timed input closure with a yellow notice and countdown.', feedback: 'Disable feedback', feedbackHint: 'Disable the good/bad response ratings independently; disabling both also rejects /feedback.', stop: 'Disable stopping', stopHint: 'Allow models to disable Stop and double-Escape interruption on this page.', privacy: 'Disable logs and session telemetry', privacyHint: 'Exclude restricted sessions from official API Session Log uploads; disable session OTel globally while a privacy restriction exists.', copy: 'Prevent transcript copying', copyHint: 'Block copy, cut, copy buttons and text dragging on this page.', active: 'Saved session restrictions', release: 'Release all restrictions', empty: 'No saved restrictions.', due: 'Due to a violation of the ', terms: 'terms of use', permanent: ', this conversation has been permanently closed.', temporary: ', this conversation is closed until ', remaining: 'Time remaining: ', hours: 'h ', minutes: 'm ', seconds: 's', positive: 'Good response', negative: 'Bad response', disabled: 'Disabled by the model', cancel: 'Cancel', submit: 'Submit', normalDisclosure: 'Submitting records feedback in DSH and may authorize uploading conversation logs.', detail: 'Feedback details (optional)', saved: 'Recorded in DSH; this is not a receipt from the official server.', feedbackTitle: 'Response feedback', compatibility: 'Stop and copy use a compatibility layer for this DSH page. Settings can release restrictions. Developer tools, screenshots, other clients and direct API calls are outside this boundary.', privacyScope: 'Privacy restrictions do not retract data already sent. Session telemetry and official API logs are separate channels. Ordinary Web does not enable desktop product telemetry.', loading: 'Loading…', error: 'Operation failed', blockedCopy: 'Copying is disabled', copyBlocked: 'Copying is not allowed', reason: 'Reason', privacyLocked: 'Disabled by a session privacy restriction', upload: 'Upload Session Log when using the official model API', telemetry: 'Session telemetry', unavailable: 'Unavailable', userControls: 'These switches grant user authorization and cannot be changed by model tools. Turning a feature off immediately stops enforcing that kind of restriction.' },
    };
    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, dictionaries));
        ctx.effect(() => ctx.locale.register(NS + '.zh', { en: dictionaries.zh, zh: dictionaries.zh }));
        ctx.effect(() => ctx.locale.register(NS + '.en', { en: dictionaries.en, zh: dictionaries.en }));
        let state = null;
        let error = '';
        const subscribers = new Set();
        let active = true;
        const publish = () => subscribers.forEach(fn => fn());
        const rpc = async (method, payload = {}) => {
          const response = await fetch(`/api/conversation-lock/${method}`, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'client-request', rpcId: `dcl-${Date.now()}-${Math.random()}`, method, payload }) });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const body = await response.json();
          if (!body.result?.ok) throw new Error(body.result?.error?.message || 'Request failed');
          return body.result.value;
        };
        let fetching = false;
        async function refresh() {
          if (fetching || !active) return;
          fetching = true;
          try { const next = await rpc('state'); if (!active) return; state = next; error = ''; publish(); }
          catch (err) { if (active) { error = err.message; publish(); } }
          finally { fetching = false; }
        }
        ctx.effect(() => {
          refresh();
          const timer = setInterval(refresh, 1500);
          return () => { active = false; clearInterval(timer); subscribers.clear(); };
        });
        function useData() {
          const [, rerender] = React.useState(0);
          React.useEffect(() => { const fn = () => rerender(n => n + 1); subscribers.add(fn); return () => subscribers.delete(fn); }, []);
          return state;
        }
        function lang() { return state?.language === 'auto' || !state?.language ? (ctx.locale.getLocale().active.startsWith('zh') ? 'zh' : 'en') : state.language; }
        // Explicit preference selects this plugin's registered dictionary without changing the app locale.
        function t(key) { return ctx.locale.bind(NS + '.' + lang())(key); }
        ctx.on('locale/change', publish);
        const getPolicy = id => {
          const p = state?.policies?.[id] || {};
          const f = state?.features || {};
          return { closed: !!f.conversation && p.closed && (p.until === null || p.until > Date.now()), until: p.until, reason: p.reason, positive: !!f.feedback && !!p.positive, negative: !!f.feedback && !!p.negative, stop: !!f.stop && !!p.stop, copy: !!f.copy && !!p.copy, privacy: !!f.privacy && !!p.privacy };
        };
        const css = `
          .dcl-page { color:var(--dsw-alias-label-primary);max-width:820px;padding:4px 0 28px;font-size:14px;line-height:1.6 }
          .dcl-page h2 {font-size:20px;font-weight:600;margin:0 0 8px}.dcl-page h3{font-size:15px;margin:26px 0 8px}
          .dcl-description{color:var(--dsw-alias-label-secondary);font-size:12px}.dcl-row{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:16px 0;border-bottom:1px solid var(--dsw-alias-border-l1)}
          .dcl-button,.dcl-page select{font:inherit;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:6px 12px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);cursor:pointer}
          .dcl-button:disabled,.dcl-switch:disabled,.dcl-rate:disabled{opacity:.4;cursor:not-allowed}.dcl-button:focus-visible,.dcl-switch:focus-visible,.dcl-rate:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
          .dcl-switch{width:36px;height:20px;flex-shrink:0;border:0;border-radius:10px;padding:2px;background:var(--dsw-alias-border-l2);cursor:pointer}.dcl-switch[aria-checked=true]{background:var(--dsw-alias-brand-primary)}.dcl-switch span{display:block;border-radius:50%;background:var(--dsw-alias-bg-base);width:16px;height:16px;transition:transform .12s}.dcl-switch[aria-checked=true] span{transform:translateX(16px)}
          .dcl-note{padding:12px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);margin:12px 0}.dcl-warning{border:1px solid var(--dsw-alias-state-warn-primary);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 13%,var(--dsw-alias-bg-base));color:var(--dsw-alias-state-warn-primary);padding:16px 20px;border-radius:12px;line-height:1.7;box-sizing:border-box;max-width:100%;text-align:center}.dcl-warning a{color:inherit;text-decoration:underline}.dcl-warning small{display:block;margin-bottom:5px}
          .dcl-dialog{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;background:color-mix(in srgb,var(--dsw-alias-label-primary) 20%,transparent);padding:16px}.dcl-dialog section{width:480px;max-width:100%;max-height:85vh;overflow:auto;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);border-radius:16px;padding:24px;box-sizing:border-box;color:var(--dsw-alias-label-primary)}.dcl-dialog textarea{box-sizing:border-box;resize:vertical;width:100%;min-height:100px;padding:10px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;color:inherit;font:inherit;margin:12px 0}.dcl-dialog footer{display:flex;justify-content:flex-end;gap:8px}.dcl-error{color:var(--dsw-alias-state-error-primary);overflow-wrap:anywhere}.dcl-rate{width:calc(28px + var(--dsh-content-font-delta,0px));height:calc(28px + var(--dsh-content-font-delta,0px));border-radius:var(--dsw-radius-sm);color:var(--dsw-alias-label-tertiary);cursor:pointer;background:transparent;border:none;justify-content:center;align-items:center;padding:6px;display:inline-flex}.dcl-rate svg{width:calc(15px + var(--dsh-content-font-delta,0px));height:calc(15px + var(--dsh-content-font-delta,0px))}@media(hover:hover){.dcl-rate:not(:disabled):hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}}.dcl-marker{display:none}.dcl-session-id{font-family:monospace;overflow-wrap:anywhere;font-size:12px}
          [data-conversation-content]:has(.dcl-closed-marker) [data-conversation-scroll] > :not([data-composer-seat]),[data-conversation-content]:has(.dcl-closed-marker) [data-composer-card]{display:none!important}
          [data-conversation-content]:has(.dcl-closed-marker) [data-composer-dock]{width:100%;justify-content:center}
          .dcl-warning{width:100%;max-width:720px;flex-shrink:1;margin-block-end:clamp(64px,16vh,160px)}
        `;
        function Style() { return h('style', null, css); }
        function Switch({ checked, disabled, label, onChange }) { return h('button', { type: 'button', className: 'dcl-switch', role: 'switch', 'aria-checked': !!checked, 'aria-label': label, disabled, onClick: () => onChange(!checked) }, h('span')); }
        async function mutate(method, payload) { const result = await rpc(method, payload); await refresh(); return result; }
        function Settings() {
          const data = useData();
          const [busy, setBusy] = React.useState(false);
          const [notice, setNotice] = React.useState('');
          async function change(method, payload) { setBusy(true); setNotice(''); try { await mutate(method, payload); } catch (err) { setNotice(err.message); } finally { setBusy(false); } }
          return h('div', { className: 'dcl-page' }, h(Style), h('h2', null, t('title')), h('p', { className: 'dcl-description' }, t('intro')), h('p', { className: 'dcl-description' }, t('userControls')),
            h('div', { className: 'dcl-row' }, h('label', { htmlFor: 'dcl-language' }, t('language')), h('select', { id: 'dcl-language', value: data?.language || 'auto', disabled: busy || !data, onChange: event => change('settings', { language: event.target.value }) }, h('option', { value: 'auto' }, t('auto')), h('option', { value: 'zh' }, '简体中文'), h('option', { value: 'en' }, 'English'))),
            ...['conversation', 'feedback', 'stop', 'privacy', 'copy'].map(key => h('div', { className: 'dcl-row', key }, h('div', null, h('div', null, t(key)), h('div', { className: 'dcl-description' }, t(key + 'Hint'))), h(Switch, { checked: data?.features[key], disabled: busy || !data, label: t(key), onChange: checked => change('settings', { [key]: checked }) }))),
            h('p', { className: 'dcl-description' }, t('compatibility')), h('p', { className: 'dcl-description' }, t('privacyScope')),
            h('div', { className: 'dcl-note' }, `${t('telemetry')}: ${data?.telemetry?.sharing || t('unavailable')}`),
            (notice || error) && h('p', { className: 'dcl-error', role: 'alert' }, notice || error),
            h('h3', null, t('active')), !data ? h('p', null, t('loading')) : Object.keys(data.policies).length === 0 ? h('p', { className: 'dcl-description' }, t('empty')) : Object.entries(data.policies).map(([id, p]) => h('div', { key: id, className: 'dcl-note' }, h('div', { className: 'dcl-session-id' }, id), h('div', { className: 'dcl-description' }, Object.entries(getPolicy(id)).filter(([key, v]) => v === true).map(([key]) => key).join(' · ') || '—'), p.reason && h('div', null, `${t('reason')}: ${p.reason}`), h('button', { className: 'dcl-button', disabled: busy, onClick: () => change('release', { sessionId: id }) }, t('release')))),
          );
        }
        function Closure({ sessionId }) {
          useData(); const p = getPolicy(sessionId);
          const [, tick] = React.useState(0);
          React.useEffect(() => { const timer = setInterval(() => tick(n => n + 1), 1000); return () => clearInterval(timer); }, []);
          if (!p.closed) return null;
          const seconds = p.until ? Math.max(0, Math.ceil((p.until - Date.now()) / 1000)) : 0;
          return h('div', { className: 'dcl-warning', role: 'status' }, h(Style), h('span', { className: 'dcl-closed-marker dcl-marker' }), h('div', null, t('due'), h('a', { href: 'https://www.deepseek.com/harness/terms-of-use/', target: '_blank', rel: 'noopener noreferrer' }, t('terms')), p.until ? t('temporary') + new Intl.DateTimeFormat(lang() === 'zh' ? 'zh-CN' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(p.until)) : t('permanent')), p.until && h('div', null, `${t('remaining')}${Math.floor(seconds / 3600)}${t('hours')}${Math.floor(seconds / 60) % 60}${t('minutes')}${seconds % 60}${t('seconds')}`), p.reason && h('div', { className: 'dcl-description' }, p.reason));
        }
        // Vector paths and geometry match DSH's MIT-licensed native feedback icons.
        function RatingIcon({ rating }) {
          const d = rating === 'positive'
            ? 'M13.537 8.12098L12.3983 12.8455C12.1818 13.7438 11.378 14.3769 10.454 14.3769L9.35595 14.3769H7.43799H5.16577C3.50892 14.3769 2.16577 13.0337 2.16577 11.3769V7.88668C2.16577 7.33439 2.61349 6.88668 3.16577 6.88668H4.02665C5.84943 6.88668 7.38083 3.28711 7.67689 2.54578C7.71259 2.45639 7.73501 2.36373 7.77922 2.27824C7.86506 2.11221 8.08228 1.87578 8.59039 2.07775C10.3291 2.76886 9.23144 6.04071 8.96955 6.75058C8.94502 6.81707 8.99495 6.88668 9.06581 6.88668H12.5648C13.2119 6.88668 13.6886 7.49192 13.537 8.12098Z'
            : 'M2.46302 8.06749L3.60171 3.34299C3.81822 2.44467 4.62196 1.81162 5.546 1.8116L6.64406 1.81158L8.56202 1.81158L10.8342 1.81158C12.4911 1.81158 13.8342 3.15473 13.8342 4.81158L13.8342 8.3018C13.8342 8.85408 13.3865 9.3018 12.8342 9.3018L11.9734 9.3018C10.1506 9.3018 8.61918 12.9014 8.32311 13.6427C8.28741 13.7321 8.26499 13.8247 8.22078 13.9102C8.13494 14.0763 7.91772 14.3127 7.40961 14.1107C5.67089 13.4196 6.76856 10.1478 7.03045 9.43789C7.05498 9.37141 7.00505 9.3018 6.93419 9.3018L3.43519 9.3018C2.78811 9.3018 2.31141 8.69656 2.46302 8.06749Z';
          return h('svg', { viewBox: '0 0 16 16', fill: 'none', strokeWidth: 1, 'aria-hidden': true, focusable: 'false' }, h('path', { d, stroke: 'currentColor' }));
        }
        function Feedback({ sessionId, messageId }) {
          useData(); const p = getPolicy(sessionId);
          const [rating, setRating] = React.useState(null);
          const [note, setNote] = React.useState('');
          const [busy, setBusy] = React.useState(false);
          const [notice, setNotice] = React.useState('');
          const dialog = React.useRef(null);
          const trigger = React.useRef(null);
          React.useEffect(() => {
            if (!rating) return;
            const before = document.activeElement;
            dialog.current?.querySelector('textarea')?.focus();
            return () => { if (before?.isConnected) before.focus(); };
          }, [rating]);
          function close() { if (!busy) { setRating(null); setNote(''); } }
          function keydown(event) {
            event.stopPropagation();
            if (event.key === 'Escape') { event.preventDefault(); close(); }
            if (event.key === 'Tab') {
              const elements = [...dialog.current.querySelectorAll('button:not(:disabled),textarea')];
              const first = elements[0], last = elements[elements.length - 1];
              if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
              else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
            }
          }
          async function submit() {
            setBusy(true); setNotice('');
            try { const result = await mutate('feedback', { sessionId, messageId, rating, note }); setNotice(t('saved')); setRating(null); setNote(''); }
            catch (err) { setNotice(err.message); }
            finally { setBusy(false); }
          }
          return h(React.Fragment, null, h(Style), ...['positive', 'negative'].map(key => {
            const blocked = !!(state && p[key]);
            return h('button', { key, className: 'dcl-rate', type: 'button', disabled: !state || blocked, 'aria-disabled': blocked || undefined, 'data-disabled': blocked ? '' : undefined, 'aria-label': t(key), 'aria-description': blocked ? t('disabled') : undefined, title: blocked ? t('disabled') : t(key), onClick: event => { if (blocked) return; trigger.current = event.currentTarget; setRating(key); setNotice(''); } }, h(RatingIcon, { rating: key }));
          }),
            notice && h('span', { className: 'dcl-description', role: 'status' }, notice),
            rating && h('div', { className: 'dcl-dialog', onKeyDown: keydown, onClick: event => { if (event.target === event.currentTarget) close(); } }, h('section', { role: 'dialog', 'aria-modal': true, 'aria-label': t('feedbackTitle'), ref: dialog }, h('h3', null, `${rating === 'positive' ? '👍' : '👎'} ${t('feedbackTitle')}`), h('p', { className: 'dcl-description' }, t('normalDisclosure')), h('textarea', { value: note, maxLength: 8192, disabled: busy, 'aria-label': t('detail'), placeholder: t('detail'), onChange: event => setNote(event.target.value) }), notice && h('p', { className: 'dcl-error', role: 'alert' }, notice), h('footer', null, h('button', { className: 'dcl-button', disabled: busy, onClick: close }, t('cancel')), h('button', { className: 'dcl-button', disabled: busy || p[rating], onClick: submit }, t('submit'))))),
          );
        }
        function UploadPreference() {
          const data = useData(); const [checked, setChecked] = React.useState(false); const [busy, setBusy] = React.useState(false); const [notice, setNotice] = React.useState('');
          const locked = Object.keys(data?.policies || {}).some(id => getPolicy(id).privacy);
          React.useEffect(() => {
            const remote = ctx.get('remote.settings');
            if (!remote) return;
            let alive = true;
            remote.describe().then(result => { if (!alive) return; const body = result?.value ?? result; const row = body?.namespaces?.find(item => item.ns === 'session-log-deepseek'); if (row) setChecked(row.value?.enabled === true); }).catch(() => {});
            return () => { alive = false; };
          }, [locked]);
          async function change(enabled) { setBusy(true); setNotice(''); try { await mutate('upload-preference', { enabled }); setChecked(enabled); } catch (err) { setNotice(err.message); } finally { setBusy(false); } }
          return h('div', { className: 'dcl-row' }, h(Style), h('div', null, h('div', null, t('upload')), h('div', { className: 'dcl-description' }, locked ? t('privacyLocked') : t('privacyScope')), notice && h('div', { className: 'dcl-error' }, notice)), h(Switch, { checked: !locked && checked, disabled: locked || busy || !data, label: t('upload'), onChange: change }));
        }
        // Scoped DOM compatibility bridge: no native owner policy exists for Stop/copy in DSH 0.2.2.
        // All modified attributes and listeners are restored at unmount; only this occurrence is affected.
        function Compatibility({ sessionId }) {
          useData(); const marker = React.useRef(null); const p = getPolicy(sessionId);
          React.useEffect(() => {
            const root = marker.current?.closest('[data-conversation-content]');
            if (!root) return;
            const altered = new Map();
            const stopPattern = /^(停止|停止生成|停止输出|停止思考|停止回答|Stop|Stop generation|Stop generating|Stop thinking|Stop reasoning)$/i;
            const copyPattern = /复制|已复制|copy|copied/i;
            function sync() {
              // One composer button switches between Stop (square glyph) and Send
              // (arrow glyph) on the same DOM node, so every pass must both apply
              // and lift the override: only buttons blocked right now stay disabled.
              const blockedNow = new Set();
              for (const button of root.querySelectorAll('button')) {
                if (button.closest('.dcl-dialog')) continue;
                const label = button.getAttribute('aria-label') || button.getAttribute('title') || '';
                // Match by accessible name only; the shared glyph would also match Send.
                const isStop = stopPattern.test(label);
                const isCopy = copyPattern.test(label) && !button.closest('[data-composer-card]');
                const shouldBlock = !!(p.stop && isStop || p.copy && isCopy || p.closed && button.closest('[data-composer-card]'));
                if (!shouldBlock) continue;
                blockedNow.add(button);
                if (!altered.has(button)) altered.set(button, { disabled: button.disabled, cursor: button.style.cursor, opacity: button.style.opacity });
                if (!button.disabled) button.disabled = true;
                if (button.style.cursor !== 'not-allowed') button.style.cursor = 'not-allowed';
                if (button.style.opacity !== '0.4') button.style.opacity = '0.4';
              }
              for (const [button, old] of altered) {
                if (blockedNow.has(button)) continue;
                altered.delete(button);
                if (!button.isConnected) continue;
                // Restore only values still owned by this compatibility layer.
                // DSH may have changed the shared Stop/Send button while a
                // restriction was active; never put its stale disabled state back.
                if (button.disabled) button.disabled = old.disabled;
                if (button.style.cursor === 'not-allowed') button.style.cursor = old.cursor;
                if (button.style.opacity === '0.4') button.style.opacity = old.opacity;
              }
            }
            const blocked = event => {
              if (!root.contains(event.target)) return;
              if (event.target.closest?.('.dcl-dialog')) return;
              const composer = event.target.closest?.('[data-composer-seat]');
              const transcript = event.target.closest?.('[data-conversation-scroll]');
              const control = event.target.closest?.('button,[role="button"]');
              const controlLabel = control?.getAttribute('aria-label') || control?.getAttribute('title') || '';
              if (p.stop && event.type === 'click' && control && stopPattern.test(controlLabel.trim())) {
                event.preventDefault(); event.stopImmediatePropagation();
                return;
              }
              if (p.copy && transcript && (event.type === 'copy' || event.type === 'cut')) {
                // Write the refusal notice into the clipboard so the user never
                // receives stale text that looks like a successful copy.
                const notice = t('copyBlocked');
                try { event.clipboardData?.setData('text/plain', notice); } catch {}
                try { navigator.clipboard?.writeText(notice)?.catch(() => {}); } catch {}
                event.preventDefault(); event.stopImmediatePropagation();
                return;
              }
              if (p.copy && transcript && event.type === 'dragstart' || p.stop && event.type === 'keydown' && event.key === 'Escape' || p.closed && composer && (event.type === 'beforeinput' || event.type === 'keydown' && event.key === 'Enter')) {
                event.preventDefault(); event.stopImmediatePropagation();
              }
            };
            ['copy', 'cut', 'dragstart', 'click', 'keydown', 'beforeinput'].forEach(type => document.addEventListener(type, blocked, true));
            const observer = new MutationObserver(sync);
            sync(); observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'aria-label'] });
            return () => {
              observer.disconnect();
              ['copy', 'cut', 'dragstart', 'click', 'keydown', 'beforeinput'].forEach(type => document.removeEventListener(type, blocked, true));
              for (const [button, old] of altered) {
                if (!button.isConnected) continue;
                if (button.disabled) button.disabled = old.disabled;
                if (button.style.cursor === 'not-allowed') button.style.cursor = old.cursor;
                if (button.style.opacity === '0.4') button.style.opacity = old.opacity;
              }
            };
          }, [sessionId, p.stop, p.copy, p.closed]);
          return h('span', { ref: marker, className: 'dcl-marker', 'data-dcl-session': sessionId });
        }
        function Dock(props) { useData(); return h(React.Fragment, null, h(Compatibility, props), h(Closure, props)); }
        ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'conversation-lock', order: 35, label: () => t('title') }, Settings));
        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({ name: 'conversation.composer.dock', id: 'conversation-lock', order: -100 }, Dock));
        ctx.slots.inject('conversation.chat.assistant-actions', () => ctx.slots.register({ name: 'conversation.chat.assistant-actions', id: 'feedback', order: 10, priority: -100 }, Feedback));
        ctx.slots.inject('settings.general.item', () => ctx.slots.register({ name: 'settings.general.item', id: 'session-log-deepseek', order: 90, priority: -100 }, UploadPreference));
      },
    };
  },
});
