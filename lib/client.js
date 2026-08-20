// .wallpaper-plugin/dsh-wallpaper-local/src/client.js
window.__ModuleLoader__.load({
  id: "dsh-wallpaper-local",
  factory: (require2) => {
    const React = require2("react");
    const LS_KEY = "dsh-wallpaper-local:v1";
    const DEFAULTS = { selected: "884307090__imgs__25.jpg", wallpaperOpacity: 1, maskOpacity: 0.45, blur: 0, panelOpacity: 0.6, fitMode: "auto" };
    const COVER_THRESHOLD = 15e5;
    function smartReadability(brightness) {
      const b = typeof brightness === "number" ? Math.max(0, Math.min(100, brightness)) : 40;
      const mask = Math.max(0.15, Math.min(0.68, 0.18 + b / 100 * 0.5));
      const panel = Math.max(0.45, Math.min(0.78, 0.48 + b / 100 * 0.3));
      return {
        maskOpacity: Math.round(mask * 100) / 100,
        panelOpacity: Math.round(panel * 100) / 100
      };
    }
    const plugin = {
      inject: ["theme"],
      apply(ctx) {
        const slots = ctx.get("slots");
        if (!slots) return;
        try {
          styles.insert(
            ".dsw-wp-card{position:relative;padding:0;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;overflow:hidden;cursor:pointer;background:var(--dsw-alias-bg-layer-2);transition:border-color .15s ease;margin:0 0 14px 0;text-align:left;display:inline-block;width:100%;vertical-align:top;break-inside:avoid;-webkit-column-break-inside:avoid;page-break-inside:avoid}.dsw-wp-card:hover{border-color:var(--dsw-alias-brand-primary)}.dsw-wp-card-img{width:100%;height:auto;display:block}.dsw-wp-scroll{overflow-y:auto;scrollbar-width:thin}.dsw-wp-scroll::-webkit-scrollbar{width:8px}.dsw-wp-scroll::-webkit-scrollbar-thumb{background:var(--dsw-alias-border-l2);border-radius:999px}.dsw-wp-slider{-webkit-appearance:none;appearance:none;height:4px;border-radius:999px;outline:none;cursor:pointer;background:linear-gradient(to right,var(--dsw-alias-brand-primary) var(--fill,50%),var(--dsw-alias-border-l2) var(--fill,50%))}.dsw-wp-slider::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:#fff;border:2px solid var(--dsw-alias-brand-primary);box-shadow:0 1px 4px rgba(0,0,0,.35);cursor:pointer;transition:transform .12s ease}.dsw-wp-slider::-webkit-slider-thumb:hover{transform:scale(1.15)}.dsw-wp-slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:#fff;border:2px solid var(--dsw-alias-brand-primary);box-shadow:0 1px 4px rgba(0,0,0,.35);cursor:pointer}.dsw-wp-btn{transition:all .15s ease}.dsw-wp-btn:hover{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l1)}.dsw-wp-btn-active{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.25)}.dsw-wp-btn-active:hover{background:var(--dsw-alias-brand-primary);color:#fff}@keyframes dswWpIn{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:none}}.dsw-wp-modal{animation:dswWpIn .2s ease-out}"
          );
        } catch (e) {
        }
        const state = { open: false, items: [], excluded: 0, chosen: null, cfg: Object.assign({}, DEFAULTS), loading: false, error: "" };
        let bgVideoEl = null;
        const listeners = /* @__PURE__ */ new Set();
        function setState(patch) {
          Object.assign(state, patch);
          listeners.forEach((fn) => fn());
        }
        function useShared() {
          const [, force] = React.useState(0);
          React.useEffect(() => {
            const fn = () => force((x) => x + 1);
            listeners.add(fn);
            return () => listeners.delete(fn);
          }, []);
          return state;
        }
        function glassTokens(p) {
          const a1 = Math.min(1, p + 0.12);
          const a2 = Math.min(1, p + 0.16);
          const a3 = Math.min(1, p + 0.22);
          return {
            "--dsw-alias-bg-base": { light: "rgba(248,250,252," + p + ")", dark: "rgba(10,13,20," + p + ")" },
            "--dsw-specific-sidebar-fill": { light: "rgba(248,250,252," + p + ")", dark: "rgba(9,12,17," + p + ")" },
            "--dsw-alias-bg-layer-1": { light: "rgba(255,255,255," + a1 + ")", dark: "rgba(17,20,28," + a1 + ")" },
            "--dsw-alias-bg-layer-2": { light: "rgba(241,243,247," + a2 + ")", dark: "rgba(23,27,37," + a2 + ")" },
            "--dsw-alias-bg-overlay": { light: "rgba(255,255,255," + a3 + ")", dark: "rgba(19,22,31," + a3 + ")" }
          };
        }
        function applyTheme() {
          try {
            ctx.theme.overrideTokens("dsh-wallpaper", glassTokens(state.cfg.panelOpacity));
          } catch (e) {
          }
        }
        function saveLocal() {
          try {
            localStorage.setItem(LS_KEY, JSON.stringify(state.cfg));
          } catch (e) {
          }
        }
        let saveTimer = null;
        function saveToHost(cfg) {
          if (saveTimer) clearTimeout(saveTimer);
          saveTimer = setTimeout(() => {
            fetch("/dsh-wallpaper/api/config", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(cfg)
            }).catch(() => {
            });
          }, 250);
        }
        function updateCfg(patch) {
          state.cfg = Object.assign({}, state.cfg, patch);
          applyTheme();
          saveLocal();
          saveToHost(state.cfg);
          setState({});
        }
        function restoreDefaults() {
          updateCfg(Object.assign({}, DEFAULTS));
        }
        function smartApply() {
          const chosen = state.chosen;
          if (!chosen) return;
          updateCfg(smartReadability(chosen.brightness || 0));
        }
        function chosenFrom(items, id) {
          let hit = null;
          for (const it of items) if (it.id === id) hit = it;
          return hit || { id, name: "", full: "/dsh-wallpaper/full/" + id, width: 0, height: 0, brightness: 0 };
        }
        function loadLocal() {
          try {
            const raw = localStorage.getItem(LS_KEY);
            if (raw) {
              const parsed = JSON.parse(raw);
              state.cfg = Object.assign({}, DEFAULTS, parsed);
              state.chosen = chosenFrom(state.items, state.cfg.selected);
              applyTheme();
              setState({});
            }
          } catch (e) {
          }
        }
        async function loadHost() {
          setState({ loading: true });
          try {
            const res = await fetch("/dsh-wallpaper/api/list");
            const data = await res.json();
            const items = data && data.items || [];
            const cfg = Object.assign({}, DEFAULTS, data && data.config || {});
            state.items = items;
            state.excluded = data && data.excluded || 0;
            state.cfg = cfg;
            state.chosen = chosenFrom(items, cfg.selected);
            applyTheme();
            saveLocal();
            setState({ loading: false, error: "" });
          } catch (e) {
            setState({ loading: false, error: "\u65E0\u6CD5\u8FDE\u63A5\u58C1\u7EB8\u670D\u52A1" });
          }
        }
        function pick(id) {
          const chosen = chosenFrom(state.items, id);
          const patch = { selected: id };
          if (chosen && chosen.brightness) {
            const smart = smartReadability(chosen.brightness);
            patch.maskOpacity = smart.maskOpacity;
            patch.panelOpacity = smart.panelOpacity;
          }
          updateCfg(patch);
          setState({ open: false, chosen });
        }
        function modeFor(cfg, chosen) {
          const fm = cfg.fitMode || "auto";
          if (fm === "cover") return "cover";
          if (fm === "contain") return "contain";
          const w = chosen && chosen.width;
          const h = chosen && chosen.height;
          if (!w || !h) return "cover";
          return w * h >= COVER_THRESHOLD ? "cover" : "contain";
        }
        function BackgroundLayer() {
          const s = useShared();
          React.useEffect(() => {
            if (!bgVideoEl) return;
            try {
              if (s.open) bgVideoEl.pause();
              else {
                const p = bgVideoEl.play();
                if (p && p.catch) p.catch(() => {
                });
              }
            } catch (e) {
            }
          }, [s.open]);
          const chosen = s.chosen;
          const cfg = s.cfg;
          const isVideo = chosen && chosen.kind === "video";
          const url = chosen && chosen.full ? 'url("' + (isVideo ? chosen.thumb : chosen.full) + '")' : "none";
          const mode = modeFor(cfg, chosen);
          const small = !isVideo && chosen && chosen.width && chosen.height ? chosen.width * chosen.height < COVER_THRESHOLD : false;
          const children = [];
          children.push(React.createElement("div", {
            key: "blur",
            style: {
              position: "absolute",
              inset: "-40px",
              backgroundImage: url,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              filter: "blur(32px) saturate(1.15)",
              transform: "scale(1.08)"
            }
          }));
          if (isVideo && chosen) {
            children.push(React.createElement("video", {
              key: "main",
              src: chosen.video,
              autoPlay: true,
              loop: true,
              muted: true,
              playsInline: true,
              ref: (el) => {
                bgVideoEl = el;
              },
              style: {
                position: "absolute",
                inset: "0",
                width: "100%",
                height: "100%",
                objectFit: mode === "contain" ? "contain" : "cover",
                filter: cfg.blur ? "blur(" + cfg.blur + "px)" : void 0,
                background: "#000"
              }
            }));
          } else if (mode === "cover") {
            children.push(React.createElement("div", {
              key: "main",
              style: {
                position: "absolute",
                inset: "0",
                backgroundImage: url,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
                filter: cfg.blur ? "blur(" + cfg.blur + "px)" : void 0
              }
            }));
          } else if (small && chosen) {
            children.push(React.createElement("img", {
              key: "main",
              src: chosen.full,
              alt: chosen.name || "wallpaper",
              style: {
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                maxWidth: "88vw",
                maxHeight: "82vh",
                width: "auto",
                height: "auto",
                borderRadius: 10,
                boxShadow: "0 18px 60px rgba(0,0,0,0.5)",
                filter: cfg.blur ? "blur(" + cfg.blur + "px)" : void 0
              }
            }));
          } else {
            children.push(React.createElement("div", {
              key: "main",
              style: {
                position: "absolute",
                inset: "0",
                backgroundImage: url,
                backgroundSize: "contain",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
                filter: cfg.blur ? "blur(" + cfg.blur + "px)" : void 0
              }
            }));
          }
          children.push(React.createElement("div", {
            key: "scrim",
            style: {
              position: "absolute",
              inset: "0",
              background: "linear-gradient(160deg, rgba(8,10,16,0.55) 0%, rgba(8,10,16,0.66) 100%)",
              opacity: cfg.maskOpacity
            }
          }));
          return React.createElement("div", {
            style: {
              position: "fixed",
              inset: "0",
              zIndex: -1,
              pointerEvents: "none",
              overflow: "hidden",
              opacity: cfg.wallpaperOpacity
            }
          }, ...children);
        }
        function ImageIcon(props) {
          const size = props.size || 16;
          return React.createElement(
            "svg",
            {
              width: size,
              height: size,
              viewBox: "0 0 24 24",
              fill: "none",
              stroke: "currentColor",
              strokeWidth: 2,
              strokeLinecap: "round",
              strokeLinejoin: "round",
              "aria-hidden": true
            },
            React.createElement("rect", { x: 3, y: 3, width: 18, height: 18, rx: 2, ry: 2 }),
            React.createElement("circle", { cx: 9, cy: 9, r: 2 }),
            React.createElement("path", { d: "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" })
          );
        }
        function WallpaperButton() {
          const s = useShared();
          React.useEffect(() => {
            loadLocal();
            loadHost();
          }, []);
          return React.createElement("button", {
            type: "button",
            title: "\u66F4\u6362\u80CC\u666F\u58C1\u7EB8",
            onClick: () => {
              const next = !s.open;
              setState({ open: next });
              if (next && !s.items.length && !s.loading) loadHost();
            },
            style: {
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              padding: 0,
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              background: "transparent",
              color: "var(--dsw-alias-label-secondary)"
            }
          }, React.createElement(ImageIcon, { size: 17 }));
        }
        function Slider(props) {
          const label = props.label;
          const value = props.value;
          const min = props.min;
          const max = props.max;
          const step = props.step;
          const display = props.display;
          const onChange = props.onChange;
          const fill = Math.round((value - min) / (max - min) * 100);
          return React.createElement(
            "label",
            {
              style: { display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--dsw-alias-label-secondary)" }
            },
            React.createElement("span", { style: { width: 84, flexShrink: 0 } }, label),
            React.createElement("input", {
              type: "range",
              className: "dsw-wp-slider",
              min,
              max,
              step,
              value,
              onChange: (e) => onChange(parseFloat(e.target.value)),
              style: { flex: 1, minWidth: 0, "--fill": fill + "%" }
            }),
            React.createElement("span", { style: { width: 46, textAlign: "right", flexShrink: 0, fontVariantNumeric: "tabular-nums" } }, display)
          );
        }
        function WallpaperCard(props) {
          const item = props.item;
          const s = props.state;
          const isCurrent = s.chosen && s.chosen.id === item.id;
          return React.createElement(
            "button",
            {
              type: "button",
              className: "dsw-wp-card" + (isCurrent ? " dsw-wp-card-ring" : ""),
              onClick: () => pick(item.id),
              title: item.name
            },
            React.createElement("img", {
              className: "dsw-wp-card-img",
              src: item.thumb,
              alt: item.name,
              loading: "lazy",
              style: item.width && item.height ? { aspectRatio: (item.width / item.height).toFixed(4) } : item.kind === "video" ? { aspectRatio: "1" } : null
            }),
            React.createElement("div", {
              style: {
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                padding: "5px 9px",
                fontSize: 11,
                textAlign: "left",
                color: "#fff",
                background: "linear-gradient(transparent, rgba(0,0,0,0.74))",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }
            }, item.name),
            item.kind === "video" ? React.createElement("div", {
              style: {
                position: "absolute",
                top: 7,
                left: 7,
                background: "rgba(0,0,0,0.6)",
                color: "#fff",
                borderRadius: 6,
                fontSize: 10,
                padding: "2px 6px",
                backdropFilter: "blur(4px)"
              }
            }, "\u25B6 \u89C6\u9891") : item.width && item.height ? React.createElement("div", {
              style: {
                position: "absolute",
                top: 7,
                left: 7,
                background: "rgba(0,0,0,0.55)",
                color: "#fff",
                borderRadius: 6,
                fontSize: 10,
                padding: "2px 6px",
                backdropFilter: "blur(4px)"
              }
            }, item.width + "\xD7" + item.height) : null,
            isCurrent ? React.createElement("div", { style: { position: "absolute", top: 7, right: 7, background: "rgba(30,160,90,0.94)", color: "#fff", borderRadius: 999, fontSize: 11, padding: "2px 9px", fontWeight: 600, boxShadow: "0 2px 8px rgba(0,0,0,.3)" } }, "\u5F53\u524D") : null
          );
        }
        function WallpaperGrid() {
          const s = useShared();
          if (!s.items.length) {
            return React.createElement("div", {
              style: { textAlign: "center", padding: 48, color: "var(--dsw-alias-label-secondary)", fontSize: 13 }
            }, s.loading ? "\u52A0\u8F7D\u4E2D\u2026" : s.error || "\u6CA1\u6709\u53EF\u7528\u7684\u58C1\u7EB8");
          }
          const installed = [];
          const images = [];
          for (const it of s.items) (it.kind === "pkg" || it.kind === "video" ? installed : images).push(it);
          const group = (title, list) => {
            if (!list.length) return null;
            return React.createElement(
              "div",
              { key: title, style: { marginBottom: 6 } },
              React.createElement(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "6px 2px 10px",
                    color: "var(--dsw-alias-label-secondary)",
                    fontSize: 11,
                    letterSpacing: ".08em",
                    textTransform: "uppercase",
                    fontWeight: 600
                  }
                },
                React.createElement("span", null, title),
                React.createElement("span", { style: { flex: 1, height: 1, background: "var(--dsw-alias-border-l1)" } })
              ),
              React.createElement(
                "div",
                { style: { columnWidth: 200, columnGap: 14 } },
                list.map((item) => React.createElement(WallpaperCard, { key: item.id, item, state: s }))
              )
            );
          };
          return React.createElement(
            React.Fragment,
            null,
            group("\u6211\u7684\u58C1\u7EB8", installed),
            group("\u56FE\u7247\u58C1\u7EB8", images),
            s.excluded > 0 ? React.createElement("div", {
              style: { fontSize: 11, color: "var(--dsw-alias-label-secondary)", padding: "6px 2px 0" }
            }, "\u5DF2\u9690\u85CF " + s.excluded + " \u5F20\u65B9\u5F62/\u4F4E\u6E05") : null
          );
        }
        function SliderRow() {
          const s = useShared();
          const cfg = s.cfg;
          const footBtn = {
            border: "1px solid var(--dsw-alias-border-l2)",
            borderRadius: 9,
            padding: "7px 13px",
            cursor: "pointer",
            fontSize: 12,
            background: "var(--dsw-alias-bg-layer-2)",
            color: "var(--dsw-alias-label-secondary)"
          };
          const modeBtn = (active) => ({
            border: active ? "1px solid var(--dsw-alias-brand-primary)" : "1px solid var(--dsw-alias-border-l2)",
            borderRadius: 9,
            padding: "6px 14px",
            cursor: "pointer",
            fontSize: 12,
            background: active ? "var(--dsw-alias-brand-primary)" : "var(--dsw-alias-bg-layer-2)",
            color: active ? "#fff" : "var(--dsw-alias-label-secondary)",
            boxShadow: active ? "0 2px 8px rgba(0,0,0,0.25)" : "none"
          });
          const modes = [
            { key: "cover", label: "\u94FA\u6EE1" },
            { key: "auto", label: "\u81EA\u52A8" },
            { key: "contain", label: "\u5B8C\u6574" }
          ];
          const modeHint = cfg.fitMode === "cover" ? "\u58C1\u7EB8\u94FA\u6EE1\u9875\u9762,\u8FB9\u7F18\u4F1A\u88C1\u6389" : cfg.fitMode === "contain" ? "\u5168\u56FE\u5C55\u793A\u4E0D\u88C1,\u56DB\u5468\u6A21\u7CCA\u6C1B\u56F4" : "\u5927\u56FE\u94FA\u6EE1,\u5C0F\u56FE\u5B8C\u6574";
          return React.createElement(
            "div",
            {
              style: { display: "flex", flexDirection: "column", gap: 10, padding: "14px 20px", borderTop: "1px solid var(--dsw-alias-border-l1)" }
            },
            React.createElement(
              "div",
              { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--dsw-alias-label-secondary)" } },
              React.createElement("span", { style: { width: 84, flexShrink: 0 } }, "\u663E\u793A\u6A21\u5F0F"),
              modes.map((m) => React.createElement("button", {
                key: m.key,
                type: "button",
                className: "dsw-wp-btn" + (cfg.fitMode === m.key ? " dsw-wp-btn-active" : ""),
                onClick: () => updateCfg({ fitMode: m.key }),
                style: modeBtn(cfg.fitMode === m.key)
              }, m.label)),
              React.createElement("span", { style: { fontSize: 11, opacity: 0.75 } }, modeHint)
            ),
            React.createElement(Slider, { label: "\u58C1\u7EB8\u900F\u660E\u5EA6", value: cfg.wallpaperOpacity, min: 0.3, max: 1, step: 0.01, display: Math.round(cfg.wallpaperOpacity * 100) + "%", onChange: (v) => updateCfg({ wallpaperOpacity: v }) }),
            React.createElement(Slider, { label: "\u538B\u6697\u906E\u7F69", value: cfg.maskOpacity, min: 0, max: 1, step: 0.01, display: Math.round(cfg.maskOpacity * 100) + "%", onChange: (v) => updateCfg({ maskOpacity: v }) }),
            React.createElement(Slider, { label: "\u80CC\u666F\u6A21\u7CCA", value: cfg.blur, min: 0, max: 40, step: 1, display: cfg.blur + "px", onChange: (v) => updateCfg({ blur: v }) }),
            React.createElement(Slider, { label: "\u9762\u677F\u4E0D\u900F\u660E", value: cfg.panelOpacity, min: 0.35, max: 0.95, step: 0.01, display: Math.round(cfg.panelOpacity * 100) + "%", onChange: (v) => updateCfg({ panelOpacity: v }) }),
            React.createElement(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2, gap: 8 } },
              React.createElement(
                "div",
                { style: { display: "flex", gap: 8 } },
                React.createElement("button", { type: "button", className: "dsw-wp-btn", onClick: smartApply, style: footBtn }, "\u2728 \u667A\u80FD\u9002\u914D"),
                React.createElement("button", { type: "button", className: "dsw-wp-btn", onClick: restoreDefaults, style: footBtn }, "\u6062\u590D\u9ED8\u8BA4")
              ),
              React.createElement("span", { style: { fontSize: 11, color: "var(--dsw-alias-label-secondary)", opacity: 0.75 } }, "\u6539\u52A8\u81EA\u52A8\u4FDD\u5B58,\u91CD\u542F\u4E0D\u4E22")
            )
          );
        }
        function PanelBody() {
          const s = useShared();
          return React.createElement(
            React.Fragment,
            null,
            React.createElement("div", {
              className: "dsw-wp-scroll",
              style: {
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                padding: 16
              }
            }, React.createElement(WallpaperGrid)),
            React.createElement(SliderRow)
          );
        }
        function PickerModal() {
          const s = useShared();
          if (!s.open) return null;
          const closeBtn = {
            width: 30,
            height: 30,
            border: "none",
            borderRadius: 9,
            cursor: "pointer",
            background: "var(--dsw-alias-bg-layer-2)",
            color: "var(--dsw-alias-label-secondary)",
            fontSize: 13,
            transition: "all .15s ease"
          };
          return React.createElement("div", {
            onClick: () => setState({ open: false }),
            style: {
              position: "absolute",
              inset: "0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(5,7,12,0.6)",
              backdropFilter: "blur(10px)"
            }
          }, React.createElement(
            "div",
            {
              className: "dsw-wp-modal",
              onClick: (e) => e.stopPropagation(),
              style: {
                width: "min(960px, 94vw)",
                maxHeight: "88vh",
                display: "flex",
                flexDirection: "column",
                borderRadius: 18,
                overflow: "hidden",
                background: "var(--dsw-alias-bg-overlay)",
                border: "1px solid var(--dsw-alias-border-l2)",
                boxShadow: "0 32px 96px rgba(0,0,0,0.5)"
              }
            },
            React.createElement(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 20px",
                  borderBottom: "1px solid var(--dsw-alias-border-l1)"
                }
              },
              React.createElement(
                "div",
                null,
                React.createElement("div", { style: { fontWeight: 700, fontSize: 15, color: "var(--dsw-alias-label-primary)" } }, "\u58C1\u7EB8\u4E0E\u5916\u89C2"),
                React.createElement("div", { style: { fontSize: 11, color: "var(--dsw-alias-label-secondary)", marginTop: 2 } }, "\u70B9\u51FB\u5E94\u7528 \xB7 \u6539\u52A8\u81EA\u52A8\u4FDD\u5B58")
              ),
              React.createElement("button", { type: "button", className: "dsw-wp-btn", onClick: () => setState({ open: false }), style: closeBtn }, "\u2715")
            ),
            React.createElement(PanelBody)
          ));
        }
        function SettingsPage() {
          return React.createElement(
            "div",
            { style: { display: "flex", flexDirection: "column", minHeight: 0, height: "100%" } },
            React.createElement("div", { style: { fontWeight: 700, fontSize: 14, padding: "16px 20px 0", color: "var(--dsw-alias-label-primary)" } }, "\u58C1\u7EB8\u4E0E\u5916\u89C2"),
            React.createElement(PanelBody)
          );
        }
        ctx.effect(() => slots.inject("sidebar.footer.action", () => slots.register(
          { name: "sidebar.footer.action", id: "dsh-wallpaper-bg", order: -100 },
          () => React.createElement(BackgroundLayer)
        )));
        ctx.effect(() => slots.inject("sidebar.footer.action", () => slots.register(
          { name: "sidebar.footer.action", id: "dsh-wallpaper-button" },
          () => React.createElement(WallpaperButton)
        )));
        ctx.effect(() => slots.inject("shell.overlay", () => slots.register(
          { name: "shell.overlay", id: "dsh-wallpaper-picker" },
          () => React.createElement(PickerModal)
        )));
        ctx.effect(() => slots.inject("settings.section", () => slots.register(
          { name: "settings.section", id: "dsh-wallpaper-settings", label: "\u58C1\u7EB8" },
          () => React.createElement(SettingsPage)
        )));
      }
    };
    return plugin;
  }
});
