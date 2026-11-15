export const CSS = `
.pr-root{position:relative;display:flex;flex-direction:column;height:100%;min-height:0;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family);font-size:13px;line-height:1.5;overflow:hidden;--pr-line:color-mix(in oklab,var(--dsw-alias-border-l1) 78%,transparent);--pr-soft:color-mix(in oklab,var(--dsw-alias-label-primary) 4%,transparent);--pr-tint:color-mix(in oklab,var(--dsw-alias-brand-primary) 7%,var(--dsw-alias-bg-base));--pr-serif:"Iowan Old Style","Palatino Linotype","Book Antiqua",Palatino,Georgia,"Times New Roman",serif;--pr-zh:var(--dsw-font-family, "Noto Sans SC"), "Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif}
.pr-root *{box-sizing:border-box}
.pr-root button,.pr-root input,.pr-root textarea,.pr-root select{font-family:inherit}
.pr-root ::selection{background:color-mix(in oklab,var(--dsw-alias-brand-primary) 26%,transparent)}

/* ---------------- library ---------------- */
.pr-lib{display:flex;flex-direction:column;height:100%;min-height:0;overflow:hidden}
.pr-lib-inner{width:100%;max-width:1180px;margin:0 auto;padding:26px 30px 0;display:flex;flex-direction:column;gap:18px}
.pr-brand{display:flex;align-items:flex-start;justify-content:space-between;gap:20px}
.pr-brand-main{display:flex;gap:13px;align-items:center;min-width:0}
.pr-brand-mark{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;flex:none;color:var(--dsw-alias-brand-primary);background:color-mix(in oklab,var(--dsw-alias-brand-primary) 10%,var(--dsw-alias-bg-base));border:.5px solid color-mix(in oklab,var(--dsw-alias-brand-primary) 22%,transparent)}
.pr-brand h1{margin:0;font-size:18px;line-height:24px;font-weight:650;letter-spacing:.1px}
.pr-brand-sub{margin-top:2px;font-size:11.5px;color:var(--dsw-alias-label-secondary)}
.pr-stats{display:flex;align-items:center;gap:16px;flex:none}
.pr-stat{display:flex;flex-direction:column;align-items:flex-end;line-height:1.2}
.pr-stat b{font-size:16px;font-weight:650;font-variant-numeric:tabular-nums}
.pr-stat span{font-size:10.5px;color:var(--dsw-alias-label-secondary)}
.pr-stat-divider{width:1px;height:24px;background:var(--pr-line)}

.pr-addbox{display:flex;align-items:center;gap:9px;padding:7px;border:.5px solid var(--pr-line);background:var(--dsw-alias-bg-layer-1);border-radius:13px;box-shadow:0 1px 0 rgba(0,0,0,.02)}
.pr-addbox:focus-within{border-color:color-mix(in oklab,var(--dsw-alias-brand-primary) 55%,var(--pr-line));box-shadow:0 0 0 3px color-mix(in oklab,var(--dsw-alias-brand-primary) 9%,transparent)}
.pr-add-icon{display:grid;place-items:center;color:var(--dsw-alias-label-secondary);padding-left:7px;flex:none}
.pr-addbox input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:var(--dsw-alias-label-primary);font-size:13px;height:30px;padding:0 2px}
.pr-addbox input::placeholder{color:var(--dsw-alias-label-secondary);opacity:.8}
.pr-add-btn{flex:none;height:30px;padding:0 14px;border-radius:8px;border:0;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary-foreground,#fff);font-size:12.5px;font-weight:550;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.pr-add-btn[disabled]{opacity:.55;cursor:default}
.pr-add-note{display:flex;align-items:center;gap:7px;font-size:11.5px;color:var(--dsw-alias-label-secondary);min-height:18px;padding-left:2px}
.pr-add-note[data-error=true]{color:var(--dsw-alias-state-error-primary)}
.pr-note-spin{width:12px;height:12px;border-radius:50%;border:2px solid color-mix(in oklab,var(--dsw-alias-brand-primary) 25%,transparent);border-top-color:var(--dsw-alias-brand-primary);animation:pr-spin .8s linear infinite;flex:none}
@keyframes pr-spin{to{transform:rotate(360deg)}}

.pr-toolbar{display:flex;align-items:center;gap:10px;justify-content:flex-start;flex-wrap:wrap;row-gap:8px}
.pr-search{position:relative;flex:1 1 220px;max-width:330px}
.pr-search input{width:100%;height:32px;border-radius:9px;border:.5px solid var(--pr-line);background:transparent;color:var(--dsw-alias-label-primary);padding:0 10px 0 32px;font-size:12.5px;outline:0}
.pr-search input:focus{border-color:color-mix(in oklab,var(--dsw-alias-brand-primary) 50%,var(--pr-line))}
.pr-search svg{position:absolute;left:10px;top:9px;color:var(--dsw-alias-label-secondary);pointer-events:none}
.pr-sort{font-size:11.5px;color:var(--dsw-alias-label-secondary);display:flex;align-items:center;gap:6px;margin-left:auto}

.pr-lib-scroll{flex:1;min-height:0;overflow-y:auto;padding:18px 30px 42px}
.pr-lib-grid-wrap{max-width:1180px;margin:0 auto}
.pr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;align-items:stretch}
.pr-card{height:100%;position:relative;display:flex;flex-direction:column;gap:9px;padding:17px 17px 14px;border:.5px solid var(--pr-line);border-radius:14px;background:var(--dsw-alias-bg-layer-1);cursor:pointer;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease;min-height:186px}
.pr-card:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(0,0,0,.07);border-color:color-mix(in oklab,var(--dsw-alias-brand-primary) 32%,var(--pr-line))}
.pr-card:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.pr-card-top{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.pr-chip{display:inline-flex;align-items:center;gap:4px;height:19px;padding:0 7px;border-radius:5px;font-size:10px;font-weight:600;letter-spacing:.3px;text-transform:uppercase;color:var(--dsw-alias-label-secondary);background:color-mix(in oklab,var(--dsw-alias-label-primary) 6%,transparent)}
.pr-chip[data-kind=pdf]{color:#b4552d;background:color-mix(in oklab,#d97757 13%,transparent)}
.pr-chip[data-kind=html]{color:#2b6b57;background:color-mix(in oklab,#3f9a78 13%,transparent)}
.pr-chip[data-kind=arxiv]{color:#8a4b9c;background:color-mix(in oklab,#b06ac4 13%,transparent)}
.pr-chip[data-type=paper]{color:#8a4b9c;background:color-mix(in oklab,#b06ac4 13%,transparent)}
.pr-chip[data-type=blog]{color:#2b6b57;background:color-mix(in oklab,#3f9a78 13%,transparent)}
.pr-chip[data-type=article]{color:#3d63a8;background:color-mix(in oklab,#5b86d6 13%,transparent)}
.pr-chip-site{max-width:180px;overflow:hidden;text-overflow:ellipsis;display:inline-flex;text-transform:none;letter-spacing:0;font-weight:500;font-size:10.5px}
.pr-card h3{margin:0;padding-right:54px;font-family:var(--pr-serif);font-size:15.5px;line-height:1.35;font-weight:600;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.pr-card-authors{font-size:11.5px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pr-card-abs{font-size:11.5px;line-height:1.55;color:var(--dsw-alias-label-secondary);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;flex:1}
.pr-card-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;padding-top:9px;border-top:.5px dashed var(--pr-line);margin-top:auto}
.pr-card-meta{display:flex;align-items:center;gap:8px;font-size:10.5px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
.pr-mini-progress{width:74px;height:3px;border-radius:2px;background:color-mix(in oklab,var(--dsw-alias-label-primary) 9%,transparent);overflow:hidden}
.pr-mini-progress i{display:block;height:100%;background:var(--dsw-alias-brand-primary);border-radius:2px;transition:width .3s ease}
.pr-card-edit{opacity:.5;position:absolute;top:10px;right:38px;width:24px;height:24px;border-radius:7px;border:0;background:transparent;color:var(--dsw-alias-label-secondary);display:grid;place-items:center;cursor:pointer;transition:opacity .15s,background .15s,color .15s}
.pr-card:hover .pr-card-edit{opacity:1}
.pr-card-edit:hover{background:color-mix(in oklab,var(--dsw-alias-brand-primary) 10%,transparent);color:var(--dsw-alias-brand-primary)}
.pr-card-del{opacity:0;position:absolute;top:10px;right:10px;width:24px;height:24px;border-radius:7px;border:0;background:transparent;color:var(--dsw-alias-label-secondary);display:grid;place-items:center;cursor:pointer;transition:opacity .15s,background .15s,color .15s}
.pr-card:hover .pr-card-del{opacity:1}
.pr-card-del:hover{background:color-mix(in oklab,var(--dsw-alias-state-error-primary) 12%,transparent);color:var(--dsw-alias-state-error-primary)}

.pr-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:10px;padding:76px 20px 100px;color:var(--dsw-alias-label-secondary)}
.pr-empty-mark{width:66px;height:66px;border-radius:20px;display:grid;place-items:center;color:var(--dsw-alias-brand-primary);background:color-mix(in oklab,var(--dsw-alias-brand-primary) 8%,transparent);margin-bottom:4px}
.pr-empty h2{margin:0;color:var(--dsw-alias-label-primary);font-size:16px;font-weight:600}
.pr-empty p{margin:0;font-size:12.5px;max-width:460px;line-height:1.7}
.pr-empty-hint{margin-top:14px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;max-width:640px;width:100%}
.pr-empty-hint div{border:.5px dashed var(--pr-line);border-radius:10px;padding:10px 12px;font-size:11px;line-height:1.5;text-align:left;color:var(--dsw-alias-label-secondary);background:color-mix(in oklab,var(--dsw-alias-bg-layer-1) 55%,transparent)}

.pr-lib-loading{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
.pr-skel{height:186px;border-radius:14px;border:.5px solid var(--pr-line);background:linear-gradient(100deg,transparent 20%,color-mix(in oklab,var(--dsw-alias-label-primary) 4%,transparent) 45%,transparent 70%) 0 0/220% 100%;animation:pr-shimmer 1.6s infinite linear}
@keyframes pr-shimmer{to{background-position:-220% 0}}

/* ---------------- reader ---------------- */
.pr-reader{position:relative;display:flex;height:100%;min-height:0;flex:1;overflow:hidden}
.pr-main{display:flex;flex-direction:column;flex:1;min-width:0;min-height:0}
.pr-reader-head{flex:none;display:flex;align-items:center;gap:12px;padding:11px 18px;border-bottom:.5px solid var(--pr-line);background:color-mix(in oklab,var(--dsw-alias-bg-base) 92%,var(--dsw-alias-bg-layer-1))}
.pr-icon-btn{width:30px;height:30px;flex:none;border-radius:8px;border:.5px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary);display:grid;place-items:center;cursor:pointer}
.pr-icon-btn:hover{background:var(--pr-soft);color:var(--dsw-alias-label-primary)}
.pr-icon-btn[data-active=true]{background:color-mix(in oklab,var(--dsw-alias-brand-primary) 11%,transparent);color:var(--dsw-alias-brand-primary);border-color:color-mix(in oklab,var(--dsw-alias-brand-primary) 22%,transparent)}
.pr-icon-btn[disabled]{opacity:.4;cursor:default}
.pr-head-title{min-width:0;flex:1;display:flex;flex-direction:column;gap:1px}
.pr-head-title b{font-family:var(--pr-serif);font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.35}
.pr-head-title span{font-size:10.5px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pr-head-actions{display:flex;align-items:center;gap:6px;flex:none}
.pr-pill-btn{height:28px;padding:0 10px;border-radius:8px;border:.5px solid var(--pr-line);background:transparent;color:var(--dsw-alias-label-secondary);font-size:11.5px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
.pr-pill-btn:hover{background:var(--pr-soft);color:var(--dsw-alias-label-primary)}
.pr-pill-btn[data-primary=true]{border-color:color-mix(in oklab,var(--dsw-alias-brand-primary) 35%,var(--pr-line));color:var(--dsw-alias-brand-primary);background:color-mix(in oklab,var(--dsw-alias-brand-primary) 8%,transparent)}
.pr-pill-btn[disabled]{opacity:.5;cursor:default}
.pr-progress{flex:none;height:2px;background:color-mix(in oklab,var(--dsw-alias-label-primary) 7%,transparent);position:relative;overflow:hidden}
.pr-progress i{position:absolute;inset:0 auto 0 0;background:linear-gradient(90deg,var(--dsw-alias-brand-primary),color-mix(in oklab,var(--dsw-alias-brand-primary) 55%,#8bd3c7));transition:width .35s ease}
.pr-progress[data-indeterminate=true] i{width:34%;animation:pr-indet 1.4s ease-in-out infinite}
@keyframes pr-indet{0%{left:-35%}100%{left:100%}}

.pr-doc{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;scroll-behavior:smooth}
.pr-paper{width:100%;max-width:1220px;margin:0 auto;padding:34px 44px 130px}
.pr-title-row{display:flex;align-items:flex-start;justify-content:space-between;gap:22px;margin-bottom:4px}
.pr-title-row h1{margin:0;font-family:var(--pr-serif);font-size:29px;line-height:1.28;font-weight:600;letter-spacing:-.2px;max-width:900px}
.pr-title-zh{margin:7px 0 0;font-family:var(--pr-zh);font-size:14px;line-height:1.6;color:var(--dsw-alias-label-secondary)}
.pr-paper-meta{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-top:13px;font-size:11.5px;color:var(--dsw-alias-label-secondary)}
.pr-dot{width:3px;height:3px;border-radius:50%;background:currentColor;opacity:.5}
.pr-abs-card{margin-top:22px;border-left:2.5px solid var(--dsw-alias-brand-primary);background:linear-gradient(90deg,var(--pr-tint),transparent 78%);border-radius:0 12px 12px 0;padding:15px 20px 15px 18px}
.pr-abs-card-label{font-size:9.5px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:var(--dsw-alias-brand-primary);margin-bottom:7px}
.pr-abs-grid{display:grid;grid-template-columns:1fr 1fr;gap:26px}
.pr-abs-en{font-family:var(--pr-serif);font-size:14.5px;line-height:1.7}
.pr-abs-zh{font-family:var(--pr-zh);font-size:13.5px;line-height:1.85;color:var(--dsw-alias-label-secondary);padding-left:24px;border-left:.5px dashed var(--pr-line)}
.pr-abs-zh:empty{display:none}

.pr-rows{display:flex;flex-direction:column;margin-top:20px;position:relative}
.pr-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);position:relative;border-top:.5px solid var(--pr-line);scroll-margin-top:64px;transition:background .18s ease;border-radius:3px}
.pr-row:first-child{border-top:0}
.pr-row:hover{background:color-mix(in oklab,var(--dsw-alias-label-primary) 2.2%,transparent)}
.pr-row.is-focus{background:color-mix(in oklab,var(--dsw-alias-brand-primary) 5%,transparent);box-shadow:inset 2px 0 0 var(--dsw-alias-brand-primary)}
.pr-col{min-width:0;padding:15px 0}
.pr-en{padding-right:30px;font-family:var(--pr-serif);font-size:16px;line-height:1.74;color:var(--dsw-alias-label-primary);letter-spacing:.05px}
.pr-zh{padding-left:30px;border-left:.5px dashed var(--pr-line);font-family:var(--pr-zh);font-size:14.5px;line-height:1.92;color:color-mix(in oklab,var(--dsw-alias-label-primary) 78%,var(--dsw-alias-label-secondary))}
.pr-en p,.pr-zh p{margin:0}
.pr-en p+p,.pr-zh p+p{margin-top:10px}
.pr-row-head{border-top:0;padding:30px 0 9px;margin-top:6px}
.pr-row-head .pr-col{padding:0}
.pr-row-head .pr-en{font-family:var(--dsw-font-family);font-size:16.5px;font-weight:650;line-height:1.45;letter-spacing:0;display:flex;align-items:baseline;gap:9px}
.pr-row-head .pr-en:before{content:"";width:3px;height:15px;border-radius:2px;background:var(--dsw-alias-brand-primary);flex:none;transform:translateY(1px)}
.pr-row-head .pr-zh{font-family:var(--pr-zh);font-size:15px;font-weight:600;line-height:1.55;color:var(--dsw-alias-label-secondary);padding-top:2px}
.pr-row-head .pr-zh:empty{border-left-color:transparent}
.pr-rows[data-mode=en] .pr-row{grid-template-columns:minmax(0,1fr)}
.pr-rows[data-mode=en] .pr-zh{display:none}
.pr-rows[data-mode=en] .pr-en{padding-right:0}
.pr-rows[data-mode=zh] .pr-row{grid-template-columns:minmax(0,1fr)}
.pr-rows[data-mode=zh] .pr-en{display:none}
.pr-rows[data-mode=zh] .pr-zh{border-left:0;padding-left:0}
.pr-rows[data-mode=zh] .pr-row-head .pr-zh{padding-top:0}
.pr-row-caption .pr-en,.pr-row-caption .pr-zh{font-size:11.5px;line-height:1.6;color:var(--dsw-alias-label-secondary);font-style:italic}
.pr-tag{position:absolute;left:-13px;top:20px;transform:translateX(-100%);font-size:9px;color:var(--dsw-alias-label-secondary);opacity:0;transition:opacity .15s;font-variant-numeric:tabular-nums}
.pr-row:hover .pr-tag{opacity:.55}
.pr-filters{display:flex;align-items:center;gap:4px;flex:none}
.pr-filter{height:28px;padding:0 10px;border-radius:8px;border:.5px solid var(--pr-line);background:transparent;color:var(--dsw-alias-label-secondary);font-size:11.5px;cursor:pointer;white-space:nowrap}
.pr-filter:hover{background:var(--pr-soft);color:var(--dsw-alias-label-primary)}
.pr-filter[data-active=true]{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary-foreground,#fff)}
.pr-type-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-label-secondary);flex:none}
.pr-type-dot[data-type=paper]{background:#a36bb5}
.pr-type-dot[data-type=blog]{background:#4b9a7f}
.pr-type-dot[data-type=article]{background:#6789cf}
.pr-list-line{display:flex;align-items:flex-start;gap:8px}
.pr-list-line p{flex:1;min-width:0}
.pr-list-mark{flex:none;min-width:14px;text-align:right;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;padding-top:1px}
.pr-code-wrap{margin:16px 0;border:.5px solid var(--pr-line);border-radius:10px;overflow:hidden;background:color-mix(in oklab,var(--dsw-alias-label-primary) 4%,var(--dsw-alias-bg-base))}
.pr-code-wrap.is-focus{border-color:color-mix(in oklab,var(--dsw-alias-brand-primary) 45%,var(--pr-line));box-shadow:inset 2px 0 0 var(--dsw-alias-brand-primary)}
.pr-code-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:5px 10px;border-bottom:.5px solid var(--pr-line);font-size:10px;color:var(--dsw-alias-label-secondary);background:color-mix(in oklab,var(--dsw-alias-label-primary) 3%,transparent)}
.pr-code-lang{font-family:var(--dsw-font-mono);text-transform:lowercase;opacity:.8}
.pr-code-copy{border:0;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:10px;cursor:pointer;padding:2px 4px;border-radius:4px}
.pr-code-copy:hover{background:var(--pr-soft);color:var(--dsw-alias-label-primary)}
.pr-code{margin:0;padding:13px 15px;overflow-x:auto;font-family:var(--dsw-font-mono);font-size:11.5px;line-height:1.65;color:var(--dsw-alias-label-primary);tab-size:2}
.pr-code code{font:inherit;background:none;padding:0;white-space:pre}
.pr-figure{position:relative;margin:22px 0 18px;border:.5px solid var(--pr-line);border-radius:12px;overflow:hidden;background:var(--dsw-alias-bg-layer-1);transition:box-shadow .18s ease,border-color .18s ease}
.pr-figure:hover{border-color:color-mix(in oklab,var(--dsw-alias-brand-primary) 26%,var(--pr-line));box-shadow:0 8px 24px rgba(0,0,0,.06)}
.pr-figure.is-focus{border-color:color-mix(in oklab,var(--dsw-alias-brand-primary) 45%,var(--pr-line));box-shadow:inset 2px 0 0 var(--dsw-alias-brand-primary)}
.pr-figure-frame{display:flex;align-items:center;justify-content:center;padding:12px;min-height:56px;background:color-mix(in oklab,var(--dsw-alias-bg-base) 70%,var(--dsw-alias-bg-layer-2))}
.pr-figure-frame img{display:block;max-width:100%;max-height:560px;object-fit:contain;border-radius:4px}
.pr-figure-caption{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);border-top:.5px solid var(--pr-line)}
.pr-figure-en{padding:11px 26px 12px 16px;font-family:var(--pr-serif);font-size:12.5px;line-height:1.65;color:var(--dsw-alias-label-secondary)}
.pr-figure-zh{padding:11px 16px 12px 26px;border-left:.5px dashed var(--pr-line);font-family:var(--pr-zh);font-size:12.5px;line-height:1.85;color:color-mix(in oklab,var(--dsw-alias-label-primary) 78%,var(--dsw-alias-label-secondary))}
.pr-figure-zh p{margin:0}
.pr-figure .pr-zh-empty{min-height:18px;gap:5px}
.pr-figure .pr-zh-skel{height:7px}
.pr-rows[data-mode=en] .pr-figure-zh{display:none}
.pr-rows[data-mode=en] .pr-figure-caption{grid-template-columns:1fr}
.pr-rows[data-mode=en] .pr-figure-en{padding-right:16px}
.pr-rows[data-mode=zh] .pr-figure-en{display:none}
.pr-rows[data-mode=zh] .pr-figure-caption{grid-template-columns:1fr}
.pr-rows[data-mode=zh] .pr-figure-zh{border-left:0;padding-left:16px}
.pr-zh-empty{min-height:24px;display:flex;flex-direction:column;gap:7px;justify-content:center}
.pr-zh-skel{height:9px;border-radius:4px;background:linear-gradient(90deg,color-mix(in oklab,var(--dsw-alias-label-primary) 6%,transparent),color-mix(in oklab,var(--dsw-alias-label-primary) 11%,transparent),color-mix(in oklab,var(--dsw-alias-label-primary) 6%,transparent));background-size:200% 100%;animation:pr-shimmer 1.5s infinite linear;width:min(94%,380px)}
.pr-zh-skel:nth-child(2){width:76%}
.pr-zh-skel:nth-child(3){width:58%}
.pr-zh-hint{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;color:var(--dsw-alias-label-secondary);opacity:.75}
.pr-zh-hint[data-error=true]{color:var(--dsw-alias-state-error-primary)}

.pr-reader-empty{display:flex;align-items:center;justify-content:center;height:100%;color:var(--dsw-alias-label-secondary);font-size:12.5px;gap:9px}

/* ---------------- chat rail ---------------- */
.pr-chat{position:relative;display:flex;flex-direction:column;width:392px;flex:none;min-height:0;border-left:.5px solid var(--pr-line);background:color-mix(in oklab,var(--dsw-alias-bg-layer-1) 55%,var(--dsw-alias-bg-base));transition:width .2s ease}
.pr-chat[data-open=false]{width:46px;cursor:pointer;background:color-mix(in oklab,var(--dsw-alias-bg-layer-1) 70%,var(--dsw-alias-bg-base))}
.pr-chat[data-open=false]:hover{background:var(--pr-soft)}
.pr-rail{width:100%;height:100%;border:0;background:transparent;color:var(--dsw-alias-label-secondary);display:flex;flex-direction:column;align-items:center;gap:14px;padding:14px 0;cursor:pointer}
.pr-rail-label{writing-mode:vertical-rl;text-orientation:mixed;letter-spacing:3px;font-size:11.5px;font-weight:550;color:var(--dsw-alias-label-secondary)}
.pr-rail-dot{width:5px;height:5px;border-radius:50%;background:var(--dsw-alias-brand-primary);box-shadow:0 0 0 3px color-mix(in oklab,var(--dsw-alias-brand-primary) 16%,transparent)}
.pr-chat-head{flex:none;height:46px;display:flex;align-items:center;gap:8px;padding:0 10px 0 14px;border-bottom:.5px solid var(--pr-line)}
.pr-chat-head b{font-size:12.5px;font-weight:600;white-space:nowrap}
.pr-chat-model{font-size:9.5px;color:var(--dsw-alias-label-secondary);padding:2px 6px;border-radius:4px;background:var(--pr-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px;font-family:var(--dsw-font-mono)}
.pr-chat-head-spacer{flex:1}
.pr-chat-body{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:16px;padding:16px 14px 10px}
.pr-chat-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;height:100%;text-align:center;padding:20px 8px;color:var(--dsw-alias-label-secondary)}
.pr-chat-empty-mark{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;color:var(--dsw-alias-brand-primary);background:color-mix(in oklab,var(--dsw-alias-brand-primary) 9%,transparent)}
.pr-chat-empty h3{margin:0;font-size:12.5px;color:var(--dsw-alias-label-primary);font-weight:600}
.pr-chat-empty p{margin:0;font-size:10.5px;line-height:1.6;max-width:250px}
.pr-suggests{display:flex;flex-direction:column;gap:6px;width:100%;margin-top:8px}
.pr-suggest{border:.5px solid var(--pr-line);background:color-mix(in oklab,var(--dsw-alias-bg-base) 55%,transparent);border-radius:8px;padding:7px 9px;font-size:10.5px;line-height:1.45;color:var(--dsw-alias-label-secondary);cursor:pointer;text-align:left}
.pr-suggest:hover{border-color:color-mix(in oklab,var(--dsw-alias-brand-primary) 35%,var(--pr-line));color:var(--dsw-alias-label-primary)}
.pr-msg{display:flex;flex-direction:column;gap:5px;max-width:100%}
.pr-msg[data-role=user]{align-items:flex-end}
.pr-msg-label{font-size:9.5px;color:var(--dsw-alias-label-secondary);letter-spacing:.4px;display:flex;align-items:center;gap:5px}
.pr-msg-user .pr-msg-bubble{max-width:88%;padding:9px 12px;border-radius:13px 13px 4px 13px;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary-foreground,#fff);font-size:12.5px;line-height:1.65;white-space:pre-wrap;word-break:break-word}
.pr-msg-assistant .pr-msg-bubble{font-size:12.5px;line-height:1.8;color:var(--dsw-alias-label-primary);padding-left:2px;word-break:break-word}
.pr-msg-error .pr-msg-bubble{font-size:11.5px;line-height:1.6;color:var(--dsw-alias-state-error-primary);background:color-mix(in oklab,var(--dsw-alias-state-error-primary) 8%,transparent);border:.5px solid color-mix(in oklab,var(--dsw-alias-state-error-primary) 25%,transparent);border-radius:9px;padding:8px 10px}
.pr-caret{display:inline-block;width:6px;height:13px;margin-left:2px;vertical-align:-2px;background:var(--dsw-alias-brand-primary);border-radius:1px;animation:pr-blink 1s steps(2,start) infinite}
@keyframes pr-blink{50%{opacity:0}}
.pr-thinking{display:inline-flex;align-items:center;gap:6px;color:var(--dsw-alias-label-secondary);font-size:11px}
.pr-thinking i{width:5px;height:5px;border-radius:50%;background:var(--dsw-alias-brand-primary);animation:pr-bounce 1.1s infinite ease-in-out}
.pr-thinking i:nth-child(2){animation-delay:.15s}
.pr-thinking i:nth-child(3){animation-delay:.3s}
@keyframes pr-bounce{0%,70%,100%{transform:translateY(0);opacity:.4}35%{transform:translateY(-3px);opacity:1}}

.pr-md p{margin:0 0 9px}
.pr-md p:last-child{margin-bottom:0}
.pr-md h1,.pr-md h2,.pr-md h3,.pr-md h4{margin:14px 0 7px;font-size:13px;line-height:1.4}
.pr-md h1:first-child,.pr-md h2:first-child,.pr-md h3:first-child{margin-top:0}
.pr-md ul,.pr-md ol{margin:4px 0 9px;padding-left:19px}
.pr-md li{margin:3px 0}
.pr-md code{font-family:var(--dsw-font-mono);font-size:11px;padding:1.5px 4px;border-radius:4px;background:color-mix(in oklab,var(--dsw-alias-label-primary) 7%,transparent)}
.pr-md pre{margin:8px 0;padding:10px;border-radius:8px;background:color-mix(in oklab,var(--dsw-alias-label-primary) 5%,transparent);border:.5px solid var(--pr-line);overflow-x:auto}
.pr-md pre code{background:none;padding:0;font-size:10.5px;line-height:1.55}
.pr-md blockquote{margin:8px 0;padding:2px 0 2px 10px;border-left:2px solid color-mix(in oklab,var(--dsw-alias-brand-primary) 40%,transparent);color:var(--dsw-alias-label-secondary)}
.pr-md a{color:var(--dsw-alias-brand-primary);text-decoration:none}
.pr-md a:hover{text-decoration:underline}
.pr-md strong{font-weight:650}
.pr-md hr{border:0;border-top:.5px solid var(--pr-line);margin:12px 0}
.pr-md table{border-collapse:collapse;font-size:11px;margin:8px 0;display:block;overflow-x:auto}
.pr-md th,.pr-md td{border:.5px solid var(--pr-line);padding:4px 7px;text-align:left}
.pr-md th{background:var(--pr-soft);font-weight:600}

.pr-composer{flex:none;border-top:.5px solid var(--pr-line);padding:10px 12px 11px;display:flex;flex-direction:column;gap:7px;background:color-mix(in oklab,var(--dsw-alias-bg-base) 85%,transparent)}
.pr-context-chips{display:flex;flex-wrap:wrap;gap:5px}
.pr-ctx{display:inline-flex;align-items:center;gap:4px;max-width:100%;font-size:10px;color:var(--dsw-alias-brand-primary);background:color-mix(in oklab,var(--dsw-alias-brand-primary) 9%,transparent);border-radius:5px;padding:2px 6px}
.pr-ctx span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px}
.pr-ctx button{border:0;background:transparent;color:inherit;cursor:pointer;padding:0;display:grid;place-items:center;opacity:.7}
.pr-ctx button:hover{opacity:1}
.pr-input-wrap{position:relative;border:.5px solid var(--pr-line);border-radius:11px;background:var(--dsw-alias-bg-layer-1);transition:border-color .15s,box-shadow .15s}
.pr-input-wrap:focus-within{border-color:color-mix(in oklab,var(--dsw-alias-brand-primary) 50%,var(--pr-line));box-shadow:0 0 0 3px color-mix(in oklab,var(--dsw-alias-brand-primary) 8%,transparent)}
.pr-input-wrap textarea{display:block;width:100%;box-sizing:border-box;border:0;outline:0;background:transparent;color:var(--dsw-alias-label-primary);resize:none;padding:9px 11px 30px;font-size:12.5px;line-height:1.6;min-height:62px;max-height:150px}
.pr-input-wrap textarea::placeholder{color:var(--dsw-alias-label-secondary);opacity:.85}
.pr-input-foot{position:absolute;left:9px;right:7px;bottom:5px;display:flex;align-items:center;justify-content:space-between;gap:8px;pointer-events:none}
.pr-input-hint{font-size:9.5px;color:var(--dsw-alias-label-secondary);opacity:.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pr-send{pointer-events:auto;width:24px;height:24px;border-radius:7px;border:0;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary-foreground,#fff);display:grid;place-items:center;cursor:pointer;flex:none}
.pr-send[disabled]{opacity:.4;cursor:default}
.pr-send[data-stop=true]{background:color-mix(in oklab,var(--dsw-alias-label-primary) 10%,transparent);color:var(--dsw-alias-label-primary)}
.pr-chat-error{font-size:10.5px;line-height:1.5;color:var(--dsw-alias-state-error-primary);padding:0 2px}

.pr-demo-overlay{position:fixed;inset:0;z-index:140;background:color-mix(in oklab,#000 42%,transparent);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;padding:26px}
.pr-demo-panel{width:min(1100px,94vw);max-height:88vh;display:flex;flex-direction:column;overflow:hidden;border-radius:16px;border:.5px solid var(--pr-line);background:var(--dsw-alias-bg-overlay);box-shadow:0 30px 90px rgba(0,0,0,.35)}
.pr-demo-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:13px 16px;border-bottom:.5px solid var(--pr-line);background:var(--dsw-alias-bg-layer-1)}
.pr-demo-head b{font-size:13.5px;font-weight:600}
.pr-demo-head span{display:block;margin-top:2px;font-size:11px;color:var(--dsw-alias-label-secondary)}
.pr-demo-scroll{overflow:auto;padding:16px 18px 22px;background:var(--dsw-alias-bg-base)}
.pr-demo-shot{margin:0 0 18px;border:.5px solid var(--pr-line);border-radius:10px;overflow:hidden;background:var(--dsw-alias-bg-layer-1)}
.pr-demo-shot:last-child{margin-bottom:0}
.pr-demo-shot img{display:block;width:100%;height:auto}
.pr-demo-shot figcaption{padding:6px 10px;border-top:.5px solid var(--pr-line);font-size:10.5px;color:var(--dsw-alias-label-secondary);letter-spacing:.02em}
.pr-modal{position:fixed;inset:0;z-index:120;display:grid;place-items:center;padding:24px;background:color-mix(in oklab,#000 34%,transparent);backdrop-filter:blur(2px)}
.pr-modal-card{width:min(520px,94vw);max-height:min(86vh,640px);overflow:auto;background:var(--dsw-alias-bg-overlay);border:.5px solid var(--pr-line);border-radius:16px;box-shadow:0 28px 80px rgba(0,0,0,.28);padding:20px 20px 18px}
.pr-modal-card h3{margin:0 0 5px;font-size:15px;font-weight:650;letter-spacing:.1px}
.pr-modal-sub{font-size:11.5px;line-height:1.6;color:var(--dsw-alias-label-secondary);margin-bottom:16px}
.pr-field{display:flex;flex-direction:column;gap:5px;margin-bottom:12px}
.pr-field label{font-size:11px;font-weight:550;color:var(--dsw-alias-label-secondary)}
.pr-field input{height:36px;border:.5px solid var(--pr-line);border-radius:9px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);padding:0 11px;font-size:12.5px;outline:0}
.pr-field input:focus{border-color:color-mix(in oklab,var(--dsw-alias-brand-primary) 55%,var(--pr-line));box-shadow:0 0 0 3px color-mix(in oklab,var(--dsw-alias-brand-primary) 9%,transparent)}
.pr-modal-error{font-size:11px;line-height:1.5;color:var(--dsw-alias-state-error-primary);margin-top:2px}
.pr-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}
.pr-modal-actions .pr-add-btn{height:30px}

@media (max-width:1200px){.pr-paper{padding:28px 30px 110px}.pr-chat{width:352px}}
@media (max-width:1000px){.pr-paper{padding:24px 22px 100px}.pr-chat{width:324px}.pr-title-row h1{font-size:25px}.pr-abs-grid{grid-template-columns:1fr;gap:12px}.pr-abs-zh{padding-left:0;border-left:0;padding-top:8px;border-top:.5px dashed var(--pr-line)}}
@media (max-width:820px){
  .pr-chat:not([data-open=false]){position:absolute;right:0;top:0;bottom:0;z-index:30;width:min(390px,94vw);box-shadow:-18px 0 40px rgba(0,0,0,.16);background:var(--dsw-alias-bg-base)}
  .pr-chat[data-open=false]{width:42px}
  .pr-en{font-size:15px;padding-right:18px}.pr-zh{padding-left:18px;font-size:13.5px}
  .pr-lib-inner{padding:18px 18px 0}.pr-lib-scroll{padding:14px 18px 32px}
  .pr-brand h1{font-size:16px}
}
@media (max-width:620px){
  .pr-row{grid-template-columns:1fr}
  .pr-figure-caption{grid-template-columns:1fr}
  .pr-figure-zh{border-left:0;border-top:.5px dashed var(--pr-line);padding:8px 16px 13px}
  .pr-figure-en{padding:10px 16px 8px}
  .pr-en{padding:14px 0 6px}
  .pr-zh{padding:6px 0 16px;border-left:0;border-top:0}
  .pr-row-head .pr-zh{padding-top:2px}
  .pr-stats{display:none}
  .pr-empty-hint{grid-template-columns:1fr}
}
`
