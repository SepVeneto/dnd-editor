import{a8 as s,i as n,o as e,aF as p}from"./chunks/framework.-UWVxQvf.js";const v=JSON.parse('{"title":"生产者","description":"","frontmatter":{"title":"生产者"},"headers":[],"relativePath":"base/producer.md","filePath":"base/producer.md"}'),l={name:"base/producer.md"};function i(t,a,c,r,o,d){return e(),n("div",null,[...a[0]||(a[0]=[p(`<h1 id="生产者" tabindex="-1">生产者 <a class="header-anchor" href="#生产者" aria-label="Permalink to &quot;生产者&quot;">​</a></h1><p>生产者负责提供所有编辑器需要用到的代码。</p><p>编辑器会根据编辑区用户的布局，通过生产者的几个渲染入口从对应的目录下找到并加载相应的代码，最终渲染到编辑区或配置区。</p><h2 id="目录结构" tabindex="-1">目录结构 <a class="header-anchor" href="#目录结构" aria-label="Permalink to &quot;目录结构&quot;">​</a></h2><p>这里只列举了关键的目录结构</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>.</span></span>
<span class="line"><span>├── package.json</span></span>
<span class="line"><span>├── rspack.config.ts</span></span>
<span class="line"><span>└── src</span></span>
<span class="line"><span>    ├── components</span></span>
<span class="line"><span>    │   ├── remoteRender.vue // 渲染入口</span></span>
<span class="line"><span>    ├── config // 配置区组件表单</span></span>
<span class="line"><span>    │   └── datepicker.config.vue</span></span>
<span class="line"><span>    ├── helper // 编辑区操作栏扩展</span></span>
<span class="line"><span>    │   └── export.vue</span></span>
<span class="line"><span>    ├── icons // 组件区图标扩展</span></span>
<span class="line"><span>    │   └── column.vue</span></span>
<span class="line"><span>    ├── skeleton // 组件区tab栏扩展</span></span>
<span class="line"><span>    │   └── template.vue</span></span>
<span class="line"><span>    └── widgets // 编辑区组件视图</span></span>
<span class="line"><span>        ├── card.view.vue</span></span>
<span class="line"><span>        ├── image.view.vue</span></span>
<span class="line"><span>        ├── menuItem.view.vue</span></span>
<span class="line"><span>        └── reserve.view.vue</span></span></code></pre></div>`,6)])])}const h=s(l,[["render",i]]);export{v as __pageData,h as default};
