var e=[{slug:`getting-started`,title:`Getting Started`,html:`<h1 id="getting-started">Getting Started</h1><p>retrypilot is a small, dependency-free library that wraps any async function, or any Fetch-compatible function, in a retry loop that:</p>
<ul>
<li>makes you <strong>declare whether the operation is safe to repeat</strong> (there is no default),</li>
<li>enforces <strong>attempt, deadline and shared-budget limits</strong> together,</li>
<li>honours <strong><code>Retry-After</code></strong> but refuses to wait unreasonably long,</li>
<li>stops <strong>immediately</strong> when you abort,</li>
<li>reports every decision as a <strong>structured event</strong>.</li>
</ul>
<blockquote>
<p><strong>Retries do not guarantee success.</strong> They help with <em>transient</em> faults only, and they add load to a system that may already be struggling. Every default here is deliberately conservative. Read <a href="#/docs/safety">Safety &amp; Idempotency</a> before enabling retries on anything that writes data.</p>
</blockquote>
<h2 id="install">Install<a class="anchor" href="#/docs/getting-started/install" aria-label="Permalink to Install">#</a></h2><div class="code-block"><span class="code-lang">sh</span><button type="button" class="code-copy" aria-label="Copy code"></button><pre class="shiki shiki-themes vitesse-light vitesse-dark" style="--shiki-light:#393a34;--shiki-dark:#dbd7caee;--shiki-light-bg:#ffffff;--shiki-dark-bg:#121212" tabindex="0"><code><span class="line"><span style="--shiki-light:#59873A;--shiki-dark:#80A665">npm</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D"> install</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D"> retrypilot</span></span></code></pre></div><p>ESM only. Requires Node 18+, or any runtime with <code>AbortController</code>, <code>fetch</code>, <code>Request</code>, <code>Response</code> and <code>Headers</code> (modern browsers, Deno, Bun, Cloudflare Workers). Tested on Node and Deno; see <a href="#/docs/testing">Testing &amp; Runtimes</a>.</p>
<h2 id="any-async-operation">Any async operation<a class="anchor" href="#/docs/getting-started/any-async-operation" aria-label="Permalink to Any async operation">#</a></h2><div class="code-block"><span class="code-lang">ts</span><button type="button" class="code-copy" aria-label="Copy code"></button><pre class="shiki shiki-themes vitesse-light vitesse-dark" style="--shiki-light:#393a34;--shiki-dark:#dbd7caee;--shiki-light-bg:#ffffff;--shiki-dark-bg:#121212" tabindex="0"><code><span class="line"><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375">import</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> {</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A"> retry</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> }</span><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375"> from</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77"> '</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D">retrypilot</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#999999;--shiki-dark:#666666">;</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#AB5959;--shiki-dark:#CB7676">const </span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">user</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> =</span><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375"> await</span><span style="--shiki-light:#59873A;--shiki-dark:#80A665"> retry</span><span style="--shiki-light:#999999;--shiki-dark:#666666">(</span></span>
<span class="line"><span style="--shiki-light:#999999;--shiki-dark:#666666">  ({</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A"> signal</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> })</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> =></span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A"> db</span><span style="--shiki-light:#999999;--shiki-dark:#666666">.</span><span style="--shiki-light:#59873A;--shiki-dark:#80A665">fetchUser</span><span style="--shiki-light:#999999;--shiki-dark:#666666">(</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">id</span><span style="--shiki-light:#999999;--shiki-dark:#666666">,</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> { </span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">signal</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> }),</span></span>
<span class="line"><span style="--shiki-light:#999999;--shiki-dark:#666666">  {</span></span>
<span class="line"><span style="--shiki-light:#998418;--shiki-dark:#B8A965">    idempotency</span><span style="--shiki-light:#999999;--shiki-dark:#666666">: </span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D">idempotent</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#999999;--shiki-dark:#666666">,   </span><span style="--shiki-light:#A0ADA0;--shiki-dark:#758575DD">// required: reads are safe to repeat</span></span>
<span class="line"><span style="--shiki-light:#998418;--shiki-dark:#B8A965">    maxAttempts</span><span style="--shiki-light:#999999;--shiki-dark:#666666">: </span><span style="--shiki-light:#2F798A;--shiki-dark:#4C9A91">4</span><span style="--shiki-light:#999999;--shiki-dark:#666666">,</span></span>
<span class="line"><span style="--shiki-light:#998418;--shiki-dark:#B8A965">    totalTimeoutMs</span><span style="--shiki-light:#999999;--shiki-dark:#666666">: </span><span style="--shiki-light:#2F798A;--shiki-dark:#4C9A91">10_000</span><span style="--shiki-light:#999999;--shiki-dark:#666666">,      </span><span style="--shiki-light:#A0ADA0;--shiki-dark:#758575DD">// whole call, waits included</span></span>
<span class="line"><span style="--shiki-light:#998418;--shiki-dark:#B8A965">    attemptTimeoutMs</span><span style="--shiki-light:#999999;--shiki-dark:#666666">: </span><span style="--shiki-light:#2F798A;--shiki-dark:#4C9A91">2_000</span><span style="--shiki-light:#999999;--shiki-dark:#666666">,     </span><span style="--shiki-light:#A0ADA0;--shiki-dark:#758575DD">// each attempt</span></span>
<span class="line"><span style="--shiki-light:#999999;--shiki-dark:#666666">  },</span></span>
<span class="line"><span style="--shiki-light:#999999;--shiki-dark:#666666">);</span></span></code></pre></div><h2 id="wrap-the-fetch-you-already-use">Wrap the <code>fetch</code> you already use<a class="anchor" href="#/docs/getting-started/wrap-the-fetch-you-already-use" aria-label="Permalink to Wrap the fetch you already use">#</a></h2><div class="code-block"><span class="code-lang">ts</span><button type="button" class="code-copy" aria-label="Copy code"></button><pre class="shiki shiki-themes vitesse-light vitesse-dark" style="--shiki-light:#393a34;--shiki-dark:#dbd7caee;--shiki-light-bg:#ffffff;--shiki-dark-bg:#121212" tabindex="0"><code><span class="line"><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375">import</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> {</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A"> createRetryFetch</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> }</span><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375"> from</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77"> '</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D">retrypilot/http</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#999999;--shiki-dark:#666666">;</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#AB5959;--shiki-dark:#CB7676">const </span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">fetchWithRetry</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> =</span><span style="--shiki-light:#59873A;--shiki-dark:#80A665"> createRetryFetch</span><span style="--shiki-light:#999999;--shiki-dark:#666666">(</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">fetch</span><span style="--shiki-light:#999999;--shiki-dark:#666666">,</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> {</span></span>
<span class="line"><span style="--shiki-light:#998418;--shiki-dark:#B8A965">  maxAttempts</span><span style="--shiki-light:#999999;--shiki-dark:#666666">: </span><span style="--shiki-light:#2F798A;--shiki-dark:#4C9A91">4</span><span style="--shiki-light:#999999;--shiki-dark:#666666">,</span></span>
<span class="line"><span style="--shiki-light:#998418;--shiki-dark:#B8A965">  totalTimeoutMs</span><span style="--shiki-light:#999999;--shiki-dark:#666666">: </span><span style="--shiki-light:#2F798A;--shiki-dark:#4C9A91">15_000</span><span style="--shiki-light:#999999;--shiki-dark:#666666">,</span></span>
<span class="line"><span style="--shiki-light:#998418;--shiki-dark:#B8A965">  attemptTimeoutMs</span><span style="--shiki-light:#999999;--shiki-dark:#666666">: </span><span style="--shiki-light:#2F798A;--shiki-dark:#4C9A91">5_000</span><span style="--shiki-light:#999999;--shiki-dark:#666666">,</span></span>
<span class="line"><span style="--shiki-light:#999999;--shiki-dark:#666666">});</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#AB5959;--shiki-dark:#CB7676">const </span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">res</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> =</span><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375"> await</span><span style="--shiki-light:#59873A;--shiki-dark:#80A665"> fetchWithRetry</span><span style="--shiki-light:#999999;--shiki-dark:#666666">(</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D">https://api.example.com/items</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#999999;--shiki-dark:#666666">);</span><span style="--shiki-light:#A0ADA0;--shiki-dark:#758575DD"> // GET: retried on 503, 429, network errors</span></span>
<span class="line"><span style="--shiki-light:#AB5959;--shiki-dark:#CB7676">const </span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">created</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> =</span><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375"> await</span><span style="--shiki-light:#59873A;--shiki-dark:#80A665"> fetchWithRetry</span><span style="--shiki-light:#999999;--shiki-dark:#666666">(</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D">https://api.example.com/items</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#999999;--shiki-dark:#666666">,</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> { </span><span style="--shiki-light:#998418;--shiki-dark:#B8A965">method</span><span style="--shiki-light:#999999;--shiki-dark:#666666">: </span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D">POST</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#999999;--shiki-dark:#666666">, </span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">body</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> });</span><span style="--shiki-light:#A0ADA0;--shiki-dark:#758575DD"> // POST: never retried</span></span></code></pre></div><p>Pass <code>globalThis.fetch</code>, undici&#39;s <code>fetch</code>, an instrumented fetch, or a test double. Nothing about your HTTP client is replaced.</p>
<h2 id="several-calls-one-policy-one-budget">Several calls, one policy, one budget<a class="anchor" href="#/docs/getting-started/several-calls-one-policy-one-budget" aria-label="Permalink to Several calls, one policy, one budget">#</a></h2><div class="code-block"><span class="code-lang">ts</span><button type="button" class="code-copy" aria-label="Copy code"></button><pre class="shiki shiki-themes vitesse-light vitesse-dark" style="--shiki-light:#393a34;--shiki-dark:#dbd7caee;--shiki-light-bg:#ffffff;--shiki-dark-bg:#121212" tabindex="0"><code><span class="line"><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375">import</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> {</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A"> RetryBudget</span><span style="--shiki-light:#999999;--shiki-dark:#666666">,</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A"> createRetryPolicy</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> }</span><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375"> from</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77"> '</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D">retrypilot</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#999999;--shiki-dark:#666666">;</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#AB5959;--shiki-dark:#CB7676">const </span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">budget</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> =</span><span style="--shiki-light:#AB5959;--shiki-dark:#CB7676"> new </span><span style="--shiki-light:#59873A;--shiki-dark:#80A665">RetryBudget</span><span style="--shiki-light:#999999;--shiki-dark:#666666">({ </span><span style="--shiki-light:#998418;--shiki-dark:#B8A965">capacity</span><span style="--shiki-light:#999999;--shiki-dark:#666666">: </span><span style="--shiki-light:#2F798A;--shiki-dark:#4C9A91">20</span><span style="--shiki-light:#999999;--shiki-dark:#666666">, </span><span style="--shiki-light:#998418;--shiki-dark:#B8A965">successRefund</span><span style="--shiki-light:#999999;--shiki-dark:#666666">: </span><span style="--shiki-light:#2F798A;--shiki-dark:#4C9A91">0.1</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> });</span><span style="--shiki-light:#A0ADA0;--shiki-dark:#758575DD"> // shared by every call</span></span>
<span class="line"><span style="--shiki-light:#AB5959;--shiki-dark:#CB7676">const </span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">policy</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> =</span><span style="--shiki-light:#59873A;--shiki-dark:#80A665"> createRetryPolicy</span><span style="--shiki-light:#999999;--shiki-dark:#666666">({</span></span>
<span class="line"><span style="--shiki-light:#998418;--shiki-dark:#B8A965">  idempotency</span><span style="--shiki-light:#999999;--shiki-dark:#666666">: </span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D">idempotent</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#999999;--shiki-dark:#666666">,</span></span>
<span class="line"><span style="--shiki-light:#998418;--shiki-dark:#B8A965">  maxAttempts</span><span style="--shiki-light:#999999;--shiki-dark:#666666">: </span><span style="--shiki-light:#2F798A;--shiki-dark:#4C9A91">3</span><span style="--shiki-light:#999999;--shiki-dark:#666666">,</span></span>
<span class="line"><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">  budget</span><span style="--shiki-light:#999999;--shiki-dark:#666666">,</span></span>
<span class="line"><span style="--shiki-light:#59873A;--shiki-dark:#80A665">  onEvent</span><span style="--shiki-light:#999999;--shiki-dark:#666666">: (</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">e</span><span style="--shiki-light:#999999;--shiki-dark:#666666">) => </span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">metrics</span><span style="--shiki-light:#999999;--shiki-dark:#666666">.</span><span style="--shiki-light:#59873A;--shiki-dark:#80A665">record</span><span style="--shiki-light:#999999;--shiki-dark:#666666">(</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">e</span><span style="--shiki-light:#999999;--shiki-dark:#666666">),</span></span>
<span class="line"><span style="--shiki-light:#999999;--shiki-dark:#666666">});</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375">await</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A"> policy</span><span style="--shiki-light:#999999;--shiki-dark:#666666">.</span><span style="--shiki-light:#59873A;--shiki-dark:#80A665">execute</span><span style="--shiki-light:#999999;--shiki-dark:#666666">(()</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> =></span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A"> cache</span><span style="--shiki-light:#999999;--shiki-dark:#666666">.</span><span style="--shiki-light:#59873A;--shiki-dark:#80A665">get</span><span style="--shiki-light:#999999;--shiki-dark:#666666">(</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">key</span><span style="--shiki-light:#999999;--shiki-dark:#666666">));</span></span>
<span class="line"><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375">await</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A"> policy</span><span style="--shiki-light:#999999;--shiki-dark:#666666">.</span><span style="--shiki-light:#59873A;--shiki-dark:#80A665">execute</span><span style="--shiki-light:#999999;--shiki-dark:#666666">(()</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> =></span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A"> store</span><span style="--shiki-light:#999999;--shiki-dark:#666666">.</span><span style="--shiki-light:#59873A;--shiki-dark:#80A665">read</span><span style="--shiki-light:#999999;--shiki-dark:#666666">(</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">id</span><span style="--shiki-light:#999999;--shiki-dark:#666666">),</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> { </span><span style="--shiki-light:#998418;--shiki-dark:#B8A965">maxAttempts</span><span style="--shiki-light:#999999;--shiki-dark:#666666">: </span><span style="--shiki-light:#2F798A;--shiki-dark:#4C9A91">5</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> });</span><span style="--shiki-light:#A0ADA0;--shiki-dark:#758575DD"> // per-call override</span></span></code></pre></div><h2 id="next">Next<a class="anchor" href="#/docs/getting-started/next" aria-label="Permalink to Next">#</a></h2><ul>
<li><a href="#/docs/concepts">How the Limits Interact</a></li>
<li><a href="#/docs/safety">Safety &amp; Idempotency</a></li>
<li><a href="#/docs/fetch">The fetch Wrapper</a></li>
</ul>
`,headings:[{depth:2,id:`install`,text:`Install`},{depth:2,id:`any-async-operation`,text:`Any async operation`},{depth:2,id:`wrap-the-fetch-you-already-use`,text:`Wrap the fetch you already use`},{depth:2,id:`several-calls-one-policy-one-budget`,text:`Several calls, one policy, one budget`},{depth:2,id:`next`,text:`Next`}]},{slug:`concepts`,title:`How the Limits Interact`,html:`<h1 id="how-the-limits-interact">How the Limits Interact</h1><p>Four independent limits apply to every call. <strong>A retry happens only if all of them allow it.</strong> The first to say no ends the loop and sets <code>RetryError.reason</code>.</p>
<div class="table-wrap"><table>
<thead>
<tr>
<th>Limit</th>
<th>Scope</th>
<th>Option</th>
<th>Ends the loop with</th>
</tr>
</thead>
<tbody><tr>
<td>Attempt limit</td>
<td>one call</td>
<td><code>maxAttempts</code> (default 3, includes the first attempt)</td>
<td><code>max-attempts</code></td>
</tr>
<tr>
<td>Deadline</td>
<td>one call, wall-clock</td>
<td><code>totalTimeoutMs</code></td>
<td><code>deadline-exceeded</code></td>
</tr>
<tr>
<td>Retry budget</td>
<td><strong>shared across calls</strong></td>
<td><code>budget</code></td>
<td><code>budget-exhausted</code></td>
</tr>
<tr>
<td>Cancellation</td>
<td>one call</td>
<td><code>signal</code></td>
<td><code>aborted</code></td>
</tr>
</tbody></table></div>
<h2 id="details-that-matter">Details that matter<a class="anchor" href="#/docs/concepts/details-that-matter" aria-label="Permalink to Details that matter">#</a></h2><ul>
<li><strong>Deadline vs attempts.</strong> <code>totalTimeoutMs</code> covers every attempt <em>and</em> every wait. A huge <code>maxAttempts</code> cannot outlive it. A retry whose wait would end at or after the deadline is not scheduled at all; the call fails right away with <code>deadline-exceeded</code> instead of sleeping and then failing. If the deadline passes mid-attempt, the attempt&#39;s signal is aborted and the call rejects at that moment, even if your operation ignores the signal.</li>
<li><strong>Per-attempt timeout vs deadline.</strong> <code>attemptTimeoutMs</code> is clipped to the time remaining, so the last attempt never overruns the deadline.</li>
<li><strong>Budget vs attempts.</strong> <code>maxAttempts</code> bounds the work of <em>one</em> call; the budget bounds the <em>aggregate</em> work of many. During an outage with <code>maxAttempts: 3</code>, every call would triple your traffic. A budget caps that: each retry spends <code>retryCost</code> tokens, each success earns back <code>successRefund</code>, and when the bucket is empty retries stop for everyone sharing it. Tokens are only spent on retries that are otherwise going to happen, so a failure that other limits reject costs nothing. The first attempt is never charged to the budget.</li>
<li><strong>Server delay vs backoff.</strong> A server-directed delay (<code>Retry-After</code>) is a <em>floor</em>: the wait is <code>max(backoff, serverDelay)</code>. If the server asks for more than <code>maxServerDelayMs</code> (default 30 s), the retry is <strong>abandoned</strong> (<code>server-delay-too-long</code>) rather than silently shortened, because retrying earlier than the server asked would likely be refused again.</li>
</ul>
<h2 id="order-of-checks-after-a-failure">Order of checks after a failure<a class="anchor" href="#/docs/concepts/order-of-checks-after-a-failure" aria-label="Permalink to Order of checks after a failure">#</a></h2><p>cancelled? → retryable? → idempotency guard → attempt limit → server delay acceptable? → fits in deadline? → budget.</p>
<p>The budget is checked last so tokens are not spent on a retry that another rule would have refused.</p>
<h2 id="backoff-and-jitter">Backoff and jitter<a class="anchor" href="#/docs/concepts/backoff-and-jitter" aria-label="Permalink to Backoff and jitter">#</a></h2><p><code>delay = min(maxDelayMs, initialDelayMs × factor^(n−1))</code>, then jitter. Defaults: 100 ms, ×2, cap 10 s, <code>full</code> jitter.</p>
<div class="table-wrap"><table>
<thead>
<tr>
<th><code>jitter</code></th>
<th>Result</th>
</tr>
</thead>
<tbody><tr>
<td><code>full</code> (default)</td>
<td>uniform in <code>[0, delay]</code>: best at de-synchronising many clients</td>
</tr>
<tr>
<td><code>equal</code></td>
<td>uniform in <code>[delay/2, delay]</code>: keeps a minimum spacing</td>
</tr>
<tr>
<td><code>none</code></td>
<td>exactly <code>delay</code></td>
</tr>
</tbody></table></div>
`,headings:[{depth:2,id:`details-that-matter`,text:`Details that matter`},{depth:2,id:`order-of-checks-after-a-failure`,text:`Order of checks after a failure`},{depth:2,id:`backoff-and-jitter`,text:`Backoff and jitter`}]},{slug:`safety`,title:`Safety & Idempotency`,html:`<h1 id="safety--idempotency">Safety &amp; Idempotency</h1><h2 id="idempotency-is-mandatory">Idempotency is mandatory<a class="anchor" href="#/docs/safety/idempotency-is-mandatory" aria-label="Permalink to Idempotency is mandatory">#</a></h2><p><code>retry()</code> throws a <code>TypeError</code> if you do not pass <code>idempotency: &#39;idempotent&#39; | &#39;non-idempotent&#39;</code>. The library will not guess.</p>
<ul>
<li><code>idempotent</code>: the failed attempt may be repeated.</li>
<li><code>non-idempotent</code>: <strong>never retried</strong>, even for network errors, even for timeouts. After a timeout or connection reset the server may already have processed the request, so repeating a payment or an order could do it twice. The exception is opt-in: <code>retryNonIdempotentWhen(error)</code> lets you declare specific errors provably safe (e.g. <code>ECONNREFUSED</code>, where nothing was ever sent). Results (such as a 503 response) are never retried for non-idempotent operations.</li>
</ul>
<h2 id="not-every-error-is-retryable">Not every error is retryable<a class="anchor" href="#/docs/safety/not-every-error-is-retryable" aria-label="Permalink to Not every error is retryable">#</a></h2><p>By default only these are retried: network-level failures (<code>ECONNRESET</code>, <code>ETIMEDOUT</code>, <code>ECONNREFUSED</code>, <code>EAI_AGAIN</code>, undici socket/timeout codes, and the <code>TypeError</code>s <code>fetch</code> throws for network failures) and attempt timeouts. A plain <code>Error</code>, a <code>TypeError</code> from your own bug, a <code>RangeError</code>, or an <code>AbortError</code> is <strong>not</strong> retried. Replace the policy with <code>isRetryable</code>:</p>
<div class="code-block"><span class="code-lang">ts</span><button type="button" class="code-copy" aria-label="Copy code"></button><pre class="shiki shiki-themes vitesse-light vitesse-dark" style="--shiki-light:#393a34;--shiki-dark:#dbd7caee;--shiki-light-bg:#ffffff;--shiki-dark-bg:#121212" tabindex="0"><code><span class="line"><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375">await</span><span style="--shiki-light:#59873A;--shiki-dark:#80A665"> retry</span><span style="--shiki-light:#999999;--shiki-dark:#666666">(</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">op</span><span style="--shiki-light:#999999;--shiki-dark:#666666">,</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> {</span></span>
<span class="line"><span style="--shiki-light:#998418;--shiki-dark:#B8A965">  idempotency</span><span style="--shiki-light:#999999;--shiki-dark:#666666">: </span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D">idempotent</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#999999;--shiki-dark:#666666">,</span></span>
<span class="line"><span style="--shiki-light:#59873A;--shiki-dark:#80A665">  isRetryable</span><span style="--shiki-light:#999999;--shiki-dark:#666666">: (</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">err</span><span style="--shiki-light:#999999;--shiki-dark:#666666">) => </span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">err</span><span style="--shiki-light:#AB5959;--shiki-dark:#CB7676"> instanceof</span><span style="--shiki-light:#2E8F82;--shiki-dark:#5DA994"> QuotaBusyError</span><span style="--shiki-light:#AB5959;--shiki-dark:#CB7676"> &#x26;&#x26;</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> { </span><span style="--shiki-light:#998418;--shiki-dark:#B8A965">retry</span><span style="--shiki-light:#999999;--shiki-dark:#666666">: </span><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375">true</span><span style="--shiki-light:#999999;--shiki-dark:#666666">, </span><span style="--shiki-light:#998418;--shiki-dark:#B8A965">delayMs</span><span style="--shiki-light:#999999;--shiki-dark:#666666">: </span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">err</span><span style="--shiki-light:#999999;--shiki-dark:#666666">.</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">retryAfterMs</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> },</span></span>
<span class="line"><span style="--shiki-light:#999999;--shiki-dark:#666666">});</span></span></code></pre></div><p>For HTTP, <code>retryStatuses</code> defaults to <code>408, 429, 500, 502, 503, 504</code>. Other <code>4xx</code> responses are returned to you unretried.</p>
<h2 id="cancellation-is-immediate-and-final">Cancellation is immediate and final<a class="anchor" href="#/docs/safety/cancellation-is-immediate-and-final" aria-label="Permalink to Cancellation is immediate and final">#</a></h2><p>Aborting <code>signal</code> interrupts a backoff wait on the spot, aborts the in-flight attempt&#39;s signal, and guarantees no further attempt starts. The call rejects with <code>RetryError { reason: &#39;aborted&#39; }</code> (the <code>fetch</code> wrapper rejects with <code>signal.reason</code>, as native <code>fetch</code> does). A signal that is already aborted starts no attempt at all. Timers and listeners are removed on every exit path, including when a long-lived signal is reused across many calls.</p>
<h2 id="observability-does-not-leak-secrets">Observability does not leak secrets<a class="anchor" href="#/docs/safety/observability-does-not-leak-secrets" aria-label="Permalink to Observability does not leak secrets">#</a></h2><p>Events never contain request or response bodies or headers. The <code>fetch</code> wrapper labels events <code>METHOD origin+path</code>: <strong>query strings, fragments and URL credentials are stripped</strong>, and retried responses are described only by status (<code>HTTP 503</code>). Error objects are passed through as-is, so if <em>your</em> errors embed sensitive data, scrub them in your <code>onEvent</code> handler. Exceptions and rejections from <code>onEvent</code> are swallowed so telemetry can never change retry behaviour.</p>
`,headings:[{depth:2,id:`idempotency-is-mandatory`,text:`Idempotency is mandatory`},{depth:2,id:`not-every-error-is-retryable`,text:`Not every error is retryable`},{depth:2,id:`cancellation-is-immediate-and-final`,text:`Cancellation is immediate and final`},{depth:2,id:`observability-does-not-leak-secrets`,text:`Observability does not leak secrets`}]},{slug:`fetch`,title:`The fetch Wrapper`,html:`<h1 id="the-fetch-wrapper">The fetch Wrapper</h1><div class="code-block"><span class="code-lang">ts</span><button type="button" class="code-copy" aria-label="Copy code"></button><pre class="shiki shiki-themes vitesse-light vitesse-dark" style="--shiki-light:#393a34;--shiki-dark:#dbd7caee;--shiki-light-bg:#ffffff;--shiki-dark-bg:#121212" tabindex="0"><code><span class="line"><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375">import</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> {</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A"> createRetryFetch</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> }</span><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375"> from</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77"> '</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D">retrypilot/http</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#999999;--shiki-dark:#666666">;</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#AB5959;--shiki-dark:#CB7676">const </span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">fetchWithRetry</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> =</span><span style="--shiki-light:#59873A;--shiki-dark:#80A665"> createRetryFetch</span><span style="--shiki-light:#999999;--shiki-dark:#666666">(</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">fetch</span><span style="--shiki-light:#999999;--shiki-dark:#666666">,</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> {</span></span>
<span class="line"><span style="--shiki-light:#998418;--shiki-dark:#B8A965">  maxAttempts</span><span style="--shiki-light:#999999;--shiki-dark:#666666">: </span><span style="--shiki-light:#2F798A;--shiki-dark:#4C9A91">4</span><span style="--shiki-light:#999999;--shiki-dark:#666666">,</span></span>
<span class="line"><span style="--shiki-light:#998418;--shiki-dark:#B8A965">  totalTimeoutMs</span><span style="--shiki-light:#999999;--shiki-dark:#666666">: </span><span style="--shiki-light:#2F798A;--shiki-dark:#4C9A91">15_000</span><span style="--shiki-light:#999999;--shiki-dark:#666666">,</span></span>
<span class="line"><span style="--shiki-light:#998418;--shiki-dark:#B8A965">  attemptTimeoutMs</span><span style="--shiki-light:#999999;--shiki-dark:#666666">: </span><span style="--shiki-light:#2F798A;--shiki-dark:#4C9A91">5_000</span><span style="--shiki-light:#999999;--shiki-dark:#666666">,</span></span>
<span class="line"><span style="--shiki-light:#999999;--shiki-dark:#666666">});</span></span></code></pre></div><h2 id="what-it-decides-for-you">What it decides for you<a class="anchor" href="#/docs/fetch/what-it-decides-for-you" aria-label="Permalink to What it decides for you">#</a></h2><div class="table-wrap"><table>
<thead>
<tr>
<th>Request</th>
<th>Retried?</th>
</tr>
</thead>
<tbody><tr>
<td><code>GET</code>, <code>HEAD</code>, <code>OPTIONS</code>, <code>PUT</code>, <code>DELETE</code>, <code>TRACE</code></td>
<td>Yes. These are idempotent per <a href="https://www.rfc-editor.org/rfc/rfc9110#section-9.2.2" target="_blank" rel="noreferrer">RFC 9110 §9.2.2</a>.</td>
</tr>
<tr>
<td><code>POST</code>, <code>PATCH</code>, anything else</td>
<td><strong>No</strong>, unless you opt in.</td>
</tr>
<tr>
<td>Request with a stream body</td>
<td><strong>Sent once.</strong> A stream cannot be replayed.</td>
</tr>
</tbody></table></div>
<h2 id="retrying-a-post">Retrying a POST<a class="anchor" href="#/docs/fetch/retrying-a-post" aria-label="Permalink to Retrying a POST">#</a></h2><p>You have three explicit options:</p>
<div class="code-block"><span class="code-lang">ts</span><button type="button" class="code-copy" aria-label="Copy code"></button><pre class="shiki shiki-themes vitesse-light vitesse-dark" style="--shiki-light:#393a34;--shiki-dark:#dbd7caee;--shiki-light-bg:#ffffff;--shiki-dark-bg:#121212" tabindex="0"><code><span class="line"><span style="--shiki-light:#A0ADA0;--shiki-dark:#758575DD">// 1. Trust an Idempotency-Key header (only if your server de-duplicates on it!)</span></span>
<span class="line"><span style="--shiki-light:#59873A;--shiki-dark:#80A665">createRetryFetch</span><span style="--shiki-light:#999999;--shiki-dark:#666666">(</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">fetch</span><span style="--shiki-light:#999999;--shiki-dark:#666666">,</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> { </span><span style="--shiki-light:#998418;--shiki-dark:#B8A965">nonIdempotentMethods</span><span style="--shiki-light:#999999;--shiki-dark:#666666">: </span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D">with-idempotency-key</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> });</span></span>
<span class="line"><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375">await</span><span style="--shiki-light:#59873A;--shiki-dark:#80A665"> f</span><span style="--shiki-light:#999999;--shiki-dark:#666666">(</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">url</span><span style="--shiki-light:#999999;--shiki-dark:#666666">,</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> { </span><span style="--shiki-light:#998418;--shiki-dark:#B8A965">method</span><span style="--shiki-light:#999999;--shiki-dark:#666666">: </span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D">POST</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#999999;--shiki-dark:#666666">, </span><span style="--shiki-light:#998418;--shiki-dark:#B8A965">headers</span><span style="--shiki-light:#999999;--shiki-dark:#666666">: { </span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D">Idempotency-Key</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#999999;--shiki-dark:#666666">: </span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">crypto</span><span style="--shiki-light:#999999;--shiki-dark:#666666">.</span><span style="--shiki-light:#59873A;--shiki-dark:#80A665">randomUUID</span><span style="--shiki-light:#999999;--shiki-dark:#666666">() }, </span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">body</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> });</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#A0ADA0;--shiki-dark:#758575DD">// 2. Declare one request safe</span></span>
<span class="line"><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375">await</span><span style="--shiki-light:#59873A;--shiki-dark:#80A665"> f</span><span style="--shiki-light:#999999;--shiki-dark:#666666">(</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">url</span><span style="--shiki-light:#999999;--shiki-dark:#666666">,</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> { </span><span style="--shiki-light:#998418;--shiki-dark:#B8A965">method</span><span style="--shiki-light:#999999;--shiki-dark:#666666">: </span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D">POST</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#999999;--shiki-dark:#666666">, </span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">body</span><span style="--shiki-light:#999999;--shiki-dark:#666666">, </span><span style="--shiki-light:#998418;--shiki-dark:#B8A965">retry</span><span style="--shiki-light:#999999;--shiki-dark:#666666">: { </span><span style="--shiki-light:#998418;--shiki-dark:#B8A965">idempotent</span><span style="--shiki-light:#999999;--shiki-dark:#666666">: </span><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375">true</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> } });</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#A0ADA0;--shiki-dark:#758575DD">// 3. Retry only failures that prove nothing was sent (connection refused, DNS failure)</span></span>
<span class="line"><span style="--shiki-light:#59873A;--shiki-dark:#80A665">createRetryFetch</span><span style="--shiki-light:#999999;--shiki-dark:#666666">(</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">fetch</span><span style="--shiki-light:#999999;--shiki-dark:#666666">,</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> { </span><span style="--shiki-light:#998418;--shiki-dark:#B8A965">retryNonIdempotentConnectionFailures</span><span style="--shiki-light:#999999;--shiki-dark:#666666">: </span><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375">true</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> });</span></span></code></pre></div><h2 id="statuses-and-retry-after">Statuses and Retry-After<a class="anchor" href="#/docs/fetch/statuses-and-retry-after" aria-label="Permalink to Statuses and Retry-After">#</a></h2><p><code>retryStatuses</code> defaults to <code>408, 429, 500, 502, 503, 504</code>. <code>Retry-After</code> is honoured on <code>429</code> and <code>503</code>, as a floor on the wait, and a delay above <code>maxServerDelayMs</code> (default 30 s) abandons the retry. Other <code>4xx</code> responses are returned unretried.</p>
<p>Pass <code>retry: false</code> on a single request to bypass retrying entirely, or <code>retry: { maxAttempts, totalTimeoutMs, attemptTimeoutMs, retryStatuses, idempotent }</code> to override the wrapper&#39;s defaults for that request.</p>
<h2 id="behaviour-to-know-about">Behaviour to know about<a class="anchor" href="#/docs/fetch/behaviour-to-know-about" aria-label="Permalink to Behaviour to know about">#</a></h2><ul>
<li><strong>Retryable responses are not thrown.</strong> After exhausting retries on a <code>503</code>, <code>fetchWithRetry</code> <em>returns</em> that response, matching <code>fetch</code>. Check <code>res.ok</code>. Thrown failures (network errors) reject with <code>RetryError</code>.</li>
<li><strong>Timeouts cover time-to-headers only.</strong> Reading the body afterwards is not bounded by <code>attemptTimeoutMs</code> or <code>totalTimeoutMs</code>.</li>
<li><strong><code>Request</code> objects are cloned per attempt</strong>, which buffers their body in memory.</li>
</ul>
`,headings:[{depth:2,id:`what-it-decides-for-you`,text:`What it decides for you`},{depth:2,id:`retrying-a-post`,text:`Retrying a POST`},{depth:2,id:`statuses-and-retry-after`,text:`Statuses and Retry-After`},{depth:2,id:`behaviour-to-know-about`,text:`Behaviour to know about`}]},{slug:`observability`,title:`Observability`,html:`<h1 id="observability">Observability</h1><div class="code-block"><span class="code-lang">ts</span><button type="button" class="code-copy" aria-label="Copy code"></button><pre class="shiki shiki-themes vitesse-light vitesse-dark" style="--shiki-light:#393a34;--shiki-dark:#dbd7caee;--shiki-light-bg:#ffffff;--shiki-dark-bg:#121212" tabindex="0"><code><span class="line"><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375">await</span><span style="--shiki-light:#59873A;--shiki-dark:#80A665"> retry</span><span style="--shiki-light:#999999;--shiki-dark:#666666">(</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">op</span><span style="--shiki-light:#999999;--shiki-dark:#666666">,</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> {</span></span>
<span class="line"><span style="--shiki-light:#998418;--shiki-dark:#B8A965">  idempotency</span><span style="--shiki-light:#999999;--shiki-dark:#666666">: </span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D">idempotent</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#999999;--shiki-dark:#666666">,</span></span>
<span class="line"><span style="--shiki-light:#998418;--shiki-dark:#B8A965">  name</span><span style="--shiki-light:#999999;--shiki-dark:#666666">: </span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D">load-profile</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#999999;--shiki-dark:#666666">,</span></span>
<span class="line"><span style="--shiki-light:#59873A;--shiki-dark:#80A665">  onEvent</span><span style="--shiki-light:#999999;--shiki-dark:#666666">(</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">e</span><span style="--shiki-light:#999999;--shiki-dark:#666666">) {</span></span>
<span class="line"><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375">    switch</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> (</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">e</span><span style="--shiki-light:#999999;--shiki-dark:#666666">.</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">type</span><span style="--shiki-light:#999999;--shiki-dark:#666666">) {</span></span>
<span class="line"><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375">      case</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77"> '</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D">attempt-started</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#999999;--shiki-dark:#666666">:  </span><span style="--shiki-light:#A0ADA0;--shiki-dark:#758575DD">/* e.attempt */</span><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375"> break</span><span style="--shiki-light:#999999;--shiki-dark:#666666">;</span></span>
<span class="line"><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375">      case</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77"> '</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D">attempt-failed</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#999999;--shiki-dark:#666666">:   </span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">log</span><span style="--shiki-light:#999999;--shiki-dark:#666666">.</span><span style="--shiki-light:#59873A;--shiki-dark:#80A665">warn</span><span style="--shiki-light:#999999;--shiki-dark:#666666">({ </span><span style="--shiki-light:#998418;--shiki-dark:#B8A965">attempt</span><span style="--shiki-light:#999999;--shiki-dark:#666666">: </span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">e</span><span style="--shiki-light:#999999;--shiki-dark:#666666">.</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">attempt</span><span style="--shiki-light:#999999;--shiki-dark:#666666">, </span><span style="--shiki-light:#998418;--shiki-dark:#B8A965">ms</span><span style="--shiki-light:#999999;--shiki-dark:#666666">: </span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">e</span><span style="--shiki-light:#999999;--shiki-dark:#666666">.</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">durationMs</span><span style="--shiki-light:#999999;--shiki-dark:#666666">, </span><span style="--shiki-light:#998418;--shiki-dark:#B8A965">err</span><span style="--shiki-light:#999999;--shiki-dark:#666666">: </span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">e</span><span style="--shiki-light:#999999;--shiki-dark:#666666">.</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">error</span><span style="--shiki-light:#AB5959;--shiki-dark:#CB7676"> ??</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A"> e</span><span style="--shiki-light:#999999;--shiki-dark:#666666">.</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">detail</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> }); </span><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375">break</span><span style="--shiki-light:#999999;--shiki-dark:#666666">;</span></span>
<span class="line"><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375">      case</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77"> '</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D">retry-scheduled</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#999999;--shiki-dark:#666666">:  </span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">metrics</span><span style="--shiki-light:#999999;--shiki-dark:#666666">.</span><span style="--shiki-light:#59873A;--shiki-dark:#80A665">increment</span><span style="--shiki-light:#999999;--shiki-dark:#666666">(</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D">retries</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#999999;--shiki-dark:#666666">, { </span><span style="--shiki-light:#998418;--shiki-dark:#B8A965">delayMs</span><span style="--shiki-light:#999999;--shiki-dark:#666666">: </span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">e</span><span style="--shiki-light:#999999;--shiki-dark:#666666">.</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">delayMs</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> }); </span><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375">break</span><span style="--shiki-light:#999999;--shiki-dark:#666666">;</span></span>
<span class="line"><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375">      case</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77"> '</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D">retry-abandoned</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#999999;--shiki-dark:#666666">:  </span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">log</span><span style="--shiki-light:#999999;--shiki-dark:#666666">.</span><span style="--shiki-light:#59873A;--shiki-dark:#80A665">warn</span><span style="--shiki-light:#999999;--shiki-dark:#666666">({ </span><span style="--shiki-light:#998418;--shiki-dark:#B8A965">reason</span><span style="--shiki-light:#999999;--shiki-dark:#666666">: </span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">e</span><span style="--shiki-light:#999999;--shiki-dark:#666666">.</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">reason</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> }); </span><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375">break</span><span style="--shiki-light:#999999;--shiki-dark:#666666">;</span></span>
<span class="line"><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375">      case</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77"> '</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D">deadline-exceeded</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#999999;--shiki-dark:#666666">: </span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">metrics</span><span style="--shiki-light:#999999;--shiki-dark:#666666">.</span><span style="--shiki-light:#59873A;--shiki-dark:#80A665">increment</span><span style="--shiki-light:#999999;--shiki-dark:#666666">(</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D">deadline</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#999999;--shiki-dark:#666666">); </span><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375">break</span><span style="--shiki-light:#999999;--shiki-dark:#666666">;</span></span>
<span class="line"><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375">      case</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77"> '</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D">operation-completed</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#999999;--shiki-dark:#666666">: </span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">metrics</span><span style="--shiki-light:#999999;--shiki-dark:#666666">.</span><span style="--shiki-light:#59873A;--shiki-dark:#80A665">timing</span><span style="--shiki-light:#999999;--shiki-dark:#666666">(</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D">op</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#999999;--shiki-dark:#666666">, </span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">e</span><span style="--shiki-light:#999999;--shiki-dark:#666666">.</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">elapsedMs</span><span style="--shiki-light:#999999;--shiki-dark:#666666">, { </span><span style="--shiki-light:#998418;--shiki-dark:#B8A965">outcome</span><span style="--shiki-light:#999999;--shiki-dark:#666666">: </span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">e</span><span style="--shiki-light:#999999;--shiki-dark:#666666">.</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">outcome</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> }); </span><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375">break</span><span style="--shiki-light:#999999;--shiki-dark:#666666">;</span></span>
<span class="line"><span style="--shiki-light:#999999;--shiki-dark:#666666">    }</span></span>
<span class="line"><span style="--shiki-light:#999999;--shiki-dark:#666666">  },</span></span>
<span class="line"><span style="--shiki-light:#999999;--shiki-dark:#666666">});</span></span></code></pre></div><p>Every event has <code>name</code>, <code>attempt</code> (attempts started so far) and <code>elapsedMs</code>.</p>
<h2 id="event-order">Event order<a class="anchor" href="#/docs/observability/event-order" aria-label="Permalink to Event order">#</a></h2><p>A failure that is retried and then succeeds produces: <code>attempt-started → attempt-failed → retry-scheduled → attempt-started → operation-completed</code>.</p>
<ul>
<li>Every <code>attempt-failed</code> is followed by either <code>retry-scheduled</code> or <code>retry-abandoned</code>.</li>
<li><code>deadline-exceeded</code> is emitted once, at the moment the deadline is detected.</li>
<li><code>operation-completed</code> is always last, and on failure carries the <code>RetryError</code>.</li>
</ul>
<h2 id="final-failure-reporting">Final failure reporting<a class="anchor" href="#/docs/observability/final-failure-reporting" aria-label="Permalink to Final failure reporting">#</a></h2><p><code>retry()</code> rejects with <code>RetryError</code>:</p>
<div class="code-block"><span class="code-lang">ts</span><button type="button" class="code-copy" aria-label="Copy code"></button><pre class="shiki shiki-themes vitesse-light vitesse-dark" style="--shiki-light:#393a34;--shiki-dark:#dbd7caee;--shiki-light-bg:#ffffff;--shiki-dark-bg:#121212" tabindex="0"><code><span class="line"><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375">try</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> {</span><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375"> await</span><span style="--shiki-light:#59873A;--shiki-dark:#80A665"> retry</span><span style="--shiki-light:#999999;--shiki-dark:#666666">(</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">op</span><span style="--shiki-light:#999999;--shiki-dark:#666666">,</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A"> opts</span><span style="--shiki-light:#999999;--shiki-dark:#666666">);</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> }</span></span>
<span class="line"><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375">catch</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> (</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">e</span><span style="--shiki-light:#999999;--shiki-dark:#666666">)</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> {</span></span>
<span class="line"><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375">  if</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> (</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">e</span><span style="--shiki-light:#AB5959;--shiki-dark:#CB7676"> instanceof</span><span style="--shiki-light:#2E8F82;--shiki-dark:#5DA994"> RetryError</span><span style="--shiki-light:#999999;--shiki-dark:#666666">)</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> {</span></span>
<span class="line"><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">    e</span><span style="--shiki-light:#999999;--shiki-dark:#666666">.</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">reason</span><span style="--shiki-light:#999999;--shiki-dark:#666666">;</span><span style="--shiki-light:#A0ADA0;--shiki-dark:#758575DD">    // 'non-retryable' | 'not-idempotent' | 'max-attempts' | 'deadline-exceeded'</span></span>
<span class="line"><span style="--shiki-light:#A0ADA0;--shiki-dark:#758575DD">                 // | 'budget-exhausted' | 'server-delay-too-long' | 'aborted'</span></span>
<span class="line"><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">    e</span><span style="--shiki-light:#999999;--shiki-dark:#666666">.</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">attempts</span><span style="--shiki-light:#999999;--shiki-dark:#666666">;</span><span style="--shiki-light:#A0ADA0;--shiki-dark:#758575DD">  // attempts started</span></span>
<span class="line"><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">    e</span><span style="--shiki-light:#999999;--shiki-dark:#666666">.</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">elapsedMs</span><span style="--shiki-light:#999999;--shiki-dark:#666666">;</span></span>
<span class="line"><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">    e</span><span style="--shiki-light:#999999;--shiki-dark:#666666">.</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">cause</span><span style="--shiki-light:#999999;--shiki-dark:#666666">;</span><span style="--shiki-light:#A0ADA0;--shiki-dark:#758575DD">     // the last error the operation threw (or the abort reason)</span></span>
<span class="line"><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">    e</span><span style="--shiki-light:#999999;--shiki-dark:#666666">.</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">result</span><span style="--shiki-light:#999999;--shiki-dark:#666666">;</span><span style="--shiki-light:#A0ADA0;--shiki-dark:#758575DD">    // for result-based failures (e.g. a 503 Response): the final, unconsumed result</span></span>
<span class="line"><span style="--shiki-light:#999999;--shiki-dark:#666666">  }</span></span>
<span class="line"><span style="--shiki-light:#999999;--shiki-dark:#666666">}</span></span></code></pre></div><h2 id="secrets">Secrets<a class="anchor" href="#/docs/observability/secrets" aria-label="Permalink to Secrets">#</a></h2><p>Events never contain bodies or headers, and the <code>fetch</code> wrapper strips query strings, fragments and URL credentials from labels. Scrub your own errors in <code>onEvent</code> if they embed sensitive data. Exceptions and rejections from <code>onEvent</code> are swallowed.</p>
`,headings:[{depth:2,id:`event-order`,text:`Event order`},{depth:2,id:`final-failure-reporting`,text:`Final failure reporting`},{depth:2,id:`secrets`,text:`Secrets`}]},{slug:`testing`,title:`Testing & Runtimes`,html:`<h1 id="testing--runtimes">Testing &amp; Runtimes</h1><h2 id="fakeclock">FakeClock<a class="anchor" href="#/docs/testing/fakeclock" aria-label="Permalink to FakeClock">#</a></h2><p><code>retrypilot/testing</code> ships the <code>FakeClock</code> used by this package&#39;s own tests. Inject it, and a deterministic <code>random</code>, to test retry behaviour without waiting:</p>
<div class="code-block"><span class="code-lang">ts</span><button type="button" class="code-copy" aria-label="Copy code"></button><pre class="shiki shiki-themes vitesse-light vitesse-dark" style="--shiki-light:#393a34;--shiki-dark:#dbd7caee;--shiki-light-bg:#ffffff;--shiki-dark-bg:#121212" tabindex="0"><code><span class="line"><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375">import</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> {</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A"> FakeClock</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> }</span><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375"> from</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77"> '</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D">retrypilot/testing</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#999999;--shiki-dark:#666666">;</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#AB5959;--shiki-dark:#CB7676">const </span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">clock</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> =</span><span style="--shiki-light:#AB5959;--shiki-dark:#CB7676"> new </span><span style="--shiki-light:#59873A;--shiki-dark:#80A665">FakeClock</span><span style="--shiki-light:#999999;--shiki-dark:#666666">();</span></span>
<span class="line"><span style="--shiki-light:#AB5959;--shiki-dark:#CB7676">const </span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">promise</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> =</span><span style="--shiki-light:#59873A;--shiki-dark:#80A665"> retry</span><span style="--shiki-light:#999999;--shiki-dark:#666666">(</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">op</span><span style="--shiki-light:#999999;--shiki-dark:#666666">,</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> { </span><span style="--shiki-light:#998418;--shiki-dark:#B8A965">idempotency</span><span style="--shiki-light:#999999;--shiki-dark:#666666">: </span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D">idempotent</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#999999;--shiki-dark:#666666">, </span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">clock</span><span style="--shiki-light:#999999;--shiki-dark:#666666">, </span><span style="--shiki-light:#59873A;--shiki-dark:#80A665">random</span><span style="--shiki-light:#999999;--shiki-dark:#666666">: () => </span><span style="--shiki-light:#2F798A;--shiki-dark:#4C9A91">0.5</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> });</span></span>
<span class="line"><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375">await</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A"> clock</span><span style="--shiki-light:#999999;--shiki-dark:#666666">.</span><span style="--shiki-light:#59873A;--shiki-dark:#80A665">advance</span><span style="--shiki-light:#999999;--shiki-dark:#666666">(</span><span style="--shiki-light:#2F798A;--shiki-dark:#4C9A91">5_000</span><span style="--shiki-light:#999999;--shiki-dark:#666666">);</span><span style="--shiki-light:#A0ADA0;--shiki-dark:#758575DD">        // fires due timers, lets promises settle</span></span>
<span class="line"><span style="--shiki-light:#59873A;--shiki-dark:#80A665">expect</span><span style="--shiki-light:#999999;--shiki-dark:#666666">(</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">clock</span><span style="--shiki-light:#999999;--shiki-dark:#666666">.</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">pendingTimers</span><span style="--shiki-light:#999999;--shiki-dark:#666666">).</span><span style="--shiki-light:#59873A;--shiki-dark:#80A665">toBe</span><span style="--shiki-light:#999999;--shiki-dark:#666666">(</span><span style="--shiki-light:#2F798A;--shiki-dark:#4C9A91">0</span><span style="--shiki-light:#999999;--shiki-dark:#666666">);</span><span style="--shiki-light:#A0ADA0;--shiki-dark:#758575DD"> // nothing leaked</span></span></code></pre></div><p>The playground on the home page is built the same way: it runs the real loop on a <code>FakeClock</code>.</p>
<h2 id="node-specific-api">Node-specific API<a class="anchor" href="#/docs/testing/node-specific-api" aria-label="Permalink to Node-specific API">#</a></h2><p>Everything else is portable. The only Node-specific piece lives at <code>retrypilot/node</code>:</p>
<div class="code-block"><span class="code-lang">ts</span><button type="button" class="code-copy" aria-label="Copy code"></button><pre class="shiki shiki-themes vitesse-light vitesse-dark" style="--shiki-light:#393a34;--shiki-dark:#dbd7caee;--shiki-light-bg:#ffffff;--shiki-dark-bg:#121212" tabindex="0"><code><span class="line"><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375">import</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> {</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A"> createUnrefClock</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> }</span><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375"> from</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77"> '</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D">retrypilot/node</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#999999;--shiki-dark:#666666">;</span><span style="--shiki-light:#A0ADA0;--shiki-dark:#758575DD"> // timers that don't keep the process alive</span></span>
<span class="line"><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375">await</span><span style="--shiki-light:#59873A;--shiki-dark:#80A665"> retry</span><span style="--shiki-light:#999999;--shiki-dark:#666666">(</span><span style="--shiki-light:#B07D48;--shiki-dark:#BD976A">op</span><span style="--shiki-light:#999999;--shiki-dark:#666666">,</span><span style="--shiki-light:#999999;--shiki-dark:#666666"> { </span><span style="--shiki-light:#998418;--shiki-dark:#B8A965">idempotency</span><span style="--shiki-light:#999999;--shiki-dark:#666666">: </span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D">idempotent</span><span style="--shiki-light:#B5695977;--shiki-dark:#C98A7D77">'</span><span style="--shiki-light:#999999;--shiki-dark:#666666">, </span><span style="--shiki-light:#998418;--shiki-dark:#B8A965">clock</span><span style="--shiki-light:#999999;--shiki-dark:#666666">: </span><span style="--shiki-light:#59873A;--shiki-dark:#80A665">createUnrefClock</span><span style="--shiki-light:#999999;--shiki-dark:#666666">() });</span></span></code></pre></div><h2 id="runtime-compatibility">Runtime compatibility<a class="anchor" href="#/docs/testing/runtime-compatibility" aria-label="Permalink to Runtime compatibility">#</a></h2><ul>
<li><code>src/</code> (everything except <code>node.ts</code>) uses no Node imports or globals; this is enforced by lint rules and by a test. It avoids <code>AbortSignal.any</code> and <code>AbortSignal.timeout</code> so it works on Node 18.</li>
<li>Checks in this repo: the full suite runs on Node, and <code>npm run test:deno</code> runs a smoke test of the <strong>built</strong> package under Deno.</li>
<li>Not tested on Bun, browsers or Workers. Nothing in the code should prevent it, but that is not verified.</li>
</ul>
`,headings:[{depth:2,id:`fakeclock`,text:`FakeClock`},{depth:2,id:`node-specific-api`,text:`Node-specific API`},{depth:2,id:`runtime-compatibility`,text:`Runtime compatibility`}]},{slug:`api`,title:`API Reference`,html:`<h1 id="api-reference">API Reference</h1><div class="table-wrap"><table>
<thead>
<tr>
<th>Export</th>
<th>From</th>
<th>Purpose</th>
</tr>
</thead>
<tbody><tr>
<td><code>retry(op, options)</code></td>
<td><code>retrypilot</code></td>
<td>Run <code>op</code> with retries</td>
</tr>
<tr>
<td><code>createRetryPolicy(defaults)</code></td>
<td><code>retrypilot</code></td>
<td>Reusable defaults; <code>.execute(op, overrides?)</code></td>
</tr>
<tr>
<td><code>RetryBudget</code></td>
<td><code>retrypilot</code></td>
<td>Shared token bucket</td>
</tr>
<tr>
<td><code>RetryError</code>, <code>AttemptTimeoutError</code>, <code>DeadlineExceededError</code></td>
<td><code>retrypilot</code></td>
<td>Error types</td>
</tr>
<tr>
<td><code>computeBackoff</code>, <code>isTransientError</code>, <code>systemClock</code></td>
<td><code>retrypilot</code></td>
<td>Building blocks</td>
</tr>
<tr>
<td><code>createRetryFetch(fetch?, options?)</code>, <code>parseRetryAfter</code>, <code>DEFAULT_RETRY_STATUSES</code></td>
<td><code>retrypilot/http</code></td>
<td>Fetch wrapper</td>
</tr>
<tr>
<td><code>createUnrefClock()</code></td>
<td><code>retrypilot/node</code></td>
<td>Node-only clock</td>
</tr>
<tr>
<td><code>FakeClock</code></td>
<td><code>retrypilot/testing</code></td>
<td>Deterministic test clock</td>
</tr>
</tbody></table></div>
<p>All types are exported from <code>retrypilot</code> (<code>RetryOptions</code>, <code>RetryEvent</code>, <code>AttemptContext</code>, ...) and <code>retrypilot/http</code> (<code>RetryFetchOptions</code>, <code>RetryFetchInit</code>, ...).</p>
<h2 id="retryop-options"><code>retry(op, options)</code><a class="anchor" href="#/docs/api/retryop-options" aria-label="Permalink to retry(op, options)">#</a></h2><p><code>op</code> receives <code>{ attempt, signal, remainingMs }</code>. Forward <code>signal</code> (for example to <code>fetch</code>) so abandoned work is really cancelled.</p>
<div class="table-wrap"><table>
<thead>
<tr>
<th>Option</th>
<th>Default</th>
<th>Meaning</th>
</tr>
</thead>
<tbody><tr>
<td><code>idempotency</code></td>
<td><strong>required</strong></td>
<td><code>&#39;idempotent&#39;</code> or <code>&#39;non-idempotent&#39;</code></td>
</tr>
<tr>
<td><code>retryNonIdempotentWhen</code></td>
<td>none</td>
<td>Declare specific errors provably safe to repeat</td>
</tr>
<tr>
<td><code>maxAttempts</code></td>
<td><code>3</code></td>
<td>Attempts including the first</td>
</tr>
<tr>
<td><code>totalTimeoutMs</code></td>
<td>none</td>
<td>Wall-clock limit for the whole call, waits included</td>
</tr>
<tr>
<td><code>attemptTimeoutMs</code></td>
<td>none</td>
<td>Limit per attempt, clipped to the time remaining</td>
</tr>
<tr>
<td><code>backoff</code></td>
<td>100 ms, ×2, cap 10 s, <code>full</code></td>
<td><code>{ initialDelayMs, factor, maxDelayMs, jitter }</code></td>
</tr>
<tr>
<td><code>maxServerDelayMs</code></td>
<td><code>30000</code></td>
<td>Largest server-directed delay honoured</td>
</tr>
<tr>
<td><code>budget</code></td>
<td>none</td>
<td>Shared <code>RetryBudget</code></td>
</tr>
<tr>
<td><code>signal</code></td>
<td>none</td>
<td>Cancels waiting and any in-flight attempt</td>
</tr>
<tr>
<td><code>isRetryable</code></td>
<td><code>isTransientError</code></td>
<td>Classify thrown errors; may return <code>{ retry, delayMs, reason }</code></td>
</tr>
<tr>
<td><code>classifyResult</code></td>
<td>none</td>
<td>Treat a returned value (such as a 503) as a retryable failure</td>
</tr>
<tr>
<td><code>disposeResult</code></td>
<td>none</td>
<td>Clean up a discarded result (for example cancel a body)</td>
</tr>
<tr>
<td><code>onEvent</code></td>
<td>none</td>
<td>Structured events</td>
</tr>
<tr>
<td><code>name</code></td>
<td>none</td>
<td>Label copied onto every event</td>
</tr>
<tr>
<td><code>clock</code>, <code>random</code></td>
<td>system</td>
<td>Inject for tests</td>
</tr>
</tbody></table></div>
<h2 id="retrybudget"><code>RetryBudget</code><a class="anchor" href="#/docs/api/retrybudget" aria-label="Permalink to RetryBudget">#</a></h2><p><code>new RetryBudget({ capacity = 10, retryCost = 1, successRefund = 0.1, refillPerSecond = 0 })</code>. Methods: <code>available</code>, <code>tryAcquire()</code>, <code>recordSuccess()</code>.</p>
<h2 id="retryerror"><code>RetryError</code><a class="anchor" href="#/docs/api/retryerror" aria-label="Permalink to RetryError">#</a></h2><p><code>reason</code>, <code>attempts</code>, <code>elapsedMs</code>, <code>cause</code>, <code>result</code>. See <a href="#/docs/observability">Observability</a>.</p>
`,headings:[{depth:2,id:`retryop-options`,text:`retry(op, options)`},{depth:2,id:`retrybudget`,text:`RetryBudget`},{depth:2,id:`retryerror`,text:`RetryError`}]},{slug:`limitations`,title:`Limitations`,html:`<h1 id="limitations">Limitations</h1><ul>
<li><strong>Retries cannot fix a persistent failure</strong> and can amplify load during an outage. Use <code>budget</code>, jitter and a deadline.</li>
<li><strong>Idempotency declarations are trusted.</strong> Marking a non-idempotent operation <code>idempotent</code> defeats the safeguard. Likewise <code>Idempotency-Key</code> mode is only safe if your server really de-duplicates.</li>
<li><strong><code>fetch</code> timeouts cover time-to-headers only.</strong> Once a response is returned, the retry layer is finished. Reading its body is not bounded by <code>attemptTimeoutMs</code> or <code>totalTimeoutMs</code>. The wrapper hands <code>fetch</code> its own per-attempt signal, so aborting <em>your</em> signal after the response has been returned does not cancel an in-progress body read; cancel the body yourself (<code>res.body.cancel()</code>) if you need that.</li>
<li><strong>Retryable responses are not thrown.</strong> After exhausting retries on a <code>503</code>, <code>fetchWithRetry</code> <em>returns</em> that response, matching <code>fetch</code>. Check <code>res.ok</code>. Thrown failures (network errors) reject with <code>RetryError</code>.</li>
<li><strong>Stream request bodies are sent once.</strong> <code>Request</code> objects are cloned per attempt, which buffers their body in memory.</li>
<li><strong>Operations that ignore <code>signal</code></strong> keep running in the background after a timeout or cancel; retrypilot stops <em>waiting</em> for them and prevents unhandled rejections but cannot kill the work.</li>
<li><strong>Single-process budgets.</strong> <code>RetryBudget</code> is in-memory; it does not coordinate across processes or machines.</li>
<li><strong>Network-error detection is heuristic</strong>, based on error codes and the messages current runtimes use; unusual clients may need a custom <code>isRetryable</code>.</li>
<li><strong>ESM only.</strong> CommonJS code on Node ≥ 22 can <code>require()</code> it; older CommonJS must use <code>import()</code>.</li>
<li><strong>Not tested on Bun, browsers or Workers.</strong> See <a href="#/docs/testing">Testing &amp; Runtimes</a>.</li>
</ul>
`,headings:[]},{slug:`comparison`,title:`Comparison`,html:`<h1 id="comparison">Comparison</h1><p>Checked against the READMEs and type definitions of the <strong>current npm versions on 2026-10-29</strong>: p-retry 8.0.1, ky 2.2.0, got 16.1.0, cockatiel 4.0.0. If you spot an inaccuracy, please open an issue.</p>
<div class="table-wrap"><table>
<thead>
<tr>
<th></th>
<th>p-retry</th>
<th>ky</th>
<th>got</th>
<th>cockatiel</th>
<th>retrypilot</th>
</tr>
</thead>
<tbody><tr>
<td>Scope</td>
<td>any promise-returning function</td>
<td>its own HTTP client</td>
<td>its own HTTP client (Node)</td>
<td>generic resilience policies</td>
<td>any async function + any <code>fetch</code></td>
</tr>
<tr>
<td>Exponential backoff</td>
<td>yes</td>
<td>yes (<code>delay</code> fn)</td>
<td>yes</td>
<td>yes</td>
<td>yes</td>
</tr>
<tr>
<td>Jitter</td>
<td><code>randomize</code> (×1–2)</td>
<td><code>jitter</code></td>
<td><code>noise</code></td>
<td>yes</td>
<td><code>none</code> / <code>full</code> / <code>equal</code></td>
</tr>
<tr>
<td><code>Retry-After</code></td>
<td>not documented</td>
<td>yes</td>
<td>yes</td>
<td>not documented</td>
<td>yes (on 429/503)</td>
</tr>
<tr>
<td>Cancellation via <code>AbortSignal</code></td>
<td>yes</td>
<td>not checked</td>
<td>not checked</td>
<td>yes</td>
<td>yes</td>
</tr>
<tr>
<td>Total deadline</td>
<td><code>maxRetryTime</code></td>
<td><code>totalTimeout</code></td>
<td>not checked</td>
<td><code>timeout</code> policy (composable)</td>
<td><code>totalTimeoutMs</code></td>
</tr>
<tr>
<td>Per-attempt timeout</td>
<td>not documented</td>
<td><code>timeout</code></td>
<td>not checked</td>
<td><code>timeout</code> policy (composable)</td>
<td><code>attemptTimeoutMs</code></td>
</tr>
<tr>
<td>Method-based retry restriction</td>
<td>n/a</td>
<td>yes (<code>methods</code>; default excludes POST/PATCH)</td>
<td>yes (<code>methods</code>; no POST by default)</td>
<td>n/a</td>
<td>yes, <strong>plus mandatory <code>idempotency</code> declaration and <code>Idempotency-Key</code> opt-in</strong></td>
</tr>
<tr>
<td>Retry count shared <strong>across calls</strong></td>
<td>no (per-call <code>retries</code>)</td>
<td>not documented</td>
<td>not documented</td>
<td>not documented</td>
<td><strong>yes (<code>RetryBudget</code>)</strong></td>
</tr>
<tr>
<td>Circuit breaker, bulkhead, fallback</td>
<td>no</td>
<td>no</td>
<td>no</td>
<td><strong>yes</strong></td>
<td><strong>no</strong></td>
</tr>
</tbody></table></div>
<p>(&quot;not documented&quot; means the feature does not appear in that version&#39;s README or type definitions; it may be achievable with hooks or custom code. &quot;not checked&quot; means it was not verified, so make no assumption either way.)</p>
<h2 id="what-retrypilot-actually-adds">What retrypilot actually adds<a class="anchor" href="#/docs/comparison/what-retrypilot-actually-adds" aria-label="Permalink to What retrypilot actually adds">#</a></h2><p>As best I can verify: (1) a retry layer that works with <em>any</em> <code>fetch</code> or async function, so you need not adopt an HTTP client to get safe HTTP retry rules, (2) a <em>required</em> idempotency declaration with an explicit, key-aware opt-in for <code>POST</code>, (3) a budget shared across calls, and (4) one uniform event stream.</p>
<p><strong>Everything else here is already available elsewhere.</strong> ky and got in particular have solid, battle-tested retry support built in; if you already use either, you probably do not need this. If you need circuit breaking or bulkheads, use cockatiel (retrypilot has neither). No performance advantage is claimed; none was measured.</p>
`,headings:[{depth:2,id:`what-retrypilot-actually-adds`,text:`What retrypilot actually adds`}]}],t=[{slug:`getting-started`,page:`Getting Started`,id:``,heading:`Getting Started`,text:`retrypilot is a small, dependency-free library that wraps any async function, or any Fetch-compatible function, in a retry loop that: makes you declare whether the operation is safe to repeat (there is no default), enforces attempt, deadline and shared-budget limits together, honours Retry-After but refuses to wait unreasonably long, stops immediately when you abort, reports every decision as a structured event. > Retries do not guarantee success. They help with transient faults only, and they add load to a system that may already be struggling. Every default here is deliberately conservative.`},{slug:`getting-started`,page:`Getting Started`,id:`install`,heading:`Install`,text:`ESM only. Requires Node 18+, or any runtime with AbortController, fetch, Request, Response and Headers (modern browsers, Deno, Bun, Cloudflare Workers). Tested on Node and Deno; see Testing & Runtimes.`},{slug:`getting-started`,page:`Getting Started`,id:`any-async-operation`,heading:`Any async operation`,text:``},{slug:`getting-started`,page:`Getting Started`,id:`wrap-the-fetch-you-already-use`,heading:`Wrap the fetch you already use`,text:`Pass globalThis.fetch, undici's fetch, an instrumented fetch, or a test double. Nothing about your HTTP client is replaced.`},{slug:`getting-started`,page:`Getting Started`,id:`several-calls-one-policy-one-budget`,heading:`Several calls, one policy, one budget`,text:``},{slug:`getting-started`,page:`Getting Started`,id:`next`,heading:`Next`,text:`How the Limits Interact Safety & Idempotency The fetch Wrapper`},{slug:`concepts`,page:`How the Limits Interact`,id:``,heading:`How the Limits Interact`,text:`Four independent limits apply to every call. A retry happens only if all of them allow it. The first to say no ends the loop and sets RetryError.reason. Limit Scope Option Ends the loop with Attempt limit one call maxAttempts (default 3, includes the first attempt) max-attempts Deadline one call, wall-clock totalTimeoutMs deadline-exceeded Retry budget shared across calls budget budget-exhausted Cancellation one call signal aborted`},{slug:`concepts`,page:`How the Limits Interact`,id:`details-that-matter`,heading:`Details that matter`,text:`Deadline vs attempts. totalTimeoutMs covers every attempt and every wait. A huge maxAttempts cannot outlive it. A retry whose wait would end at or after the deadline is not scheduled at all; the call fails right away with deadline-exceeded instead of sleeping and then failing. If the deadline passes mid-attempt, the attempt's signal is aborted and the call rejects at that moment, even if your operation ignores the signal. Per-attempt timeout vs deadline. attemptTimeoutMs is clipped to the time remaining, so the last attempt never overruns the deadline. Budget vs attempts. maxAttempts bounds th`},{slug:`concepts`,page:`How the Limits Interact`,id:`order-of-checks-after-a-failure`,heading:`Order of checks after a failure`,text:`cancelled? → retryable? → idempotency guard → attempt limit → server delay acceptable? → fits in deadline? → budget. The budget is checked last so tokens are not spent on a retry that another rule would have refused.`},{slug:`concepts`,page:`How the Limits Interact`,id:`backoff-and-jitter`,heading:`Backoff and jitter`,text:`delay = min(maxDelayMs, initialDelayMs × factor^(n−1)), then jitter. Defaults: 100 ms, ×2, cap 10 s, full jitter. jitter Result full (default) uniform in [0, delay]: best at de-synchronising many clients equal uniform in [delay/2, delay]: keeps a minimum spacing none exactly delay`},{slug:`safety`,page:`Safety & Idempotency`,id:`idempotency-is-mandatory`,heading:`Idempotency is mandatory`,text:`retry() throws a TypeError if you do not pass idempotency: 'idempotent' 'non-idempotent'. The library will not guess. idempotent: the failed attempt may be repeated. non-idempotent: never retried, even for network errors, even for timeouts. After a timeout or connection reset the server may already have processed the request, so repeating a payment or an order could do it twice. The exception is opt-in: retryNonIdempotentWhen(error) lets you declare specific errors provably safe (e.g. ECONNREFUSED, where nothing was ever sent). Results (such as a 503 response) are never retried for non-idempot`},{slug:`safety`,page:`Safety & Idempotency`,id:`not-every-error-is-retryable`,heading:`Not every error is retryable`,text:`By default only these are retried: network-level failures (ECONNRESET, ETIMEDOUT, ECONNREFUSED, EAIAGAIN, undici socket/timeout codes, and the TypeErrors fetch throws for network failures) and attempt timeouts. A plain Error, a TypeError from your own bug, a RangeError, or an AbortError is not retried. Replace the policy with isRetryable: For HTTP, retryStatuses defaults to 408, 429, 500, 502, 503, 504. Other 4xx responses are returned to you unretried.`},{slug:`safety`,page:`Safety & Idempotency`,id:`cancellation-is-immediate-and-final`,heading:`Cancellation is immediate and final`,text:`Aborting signal interrupts a backoff wait on the spot, aborts the in-flight attempt's signal, and guarantees no further attempt starts. The call rejects with RetryError { reason: 'aborted' } (the fetch wrapper rejects with signal.reason, as native fetch does). A signal that is already aborted starts no attempt at all. Timers and listeners are removed on every exit path, including when a long-lived signal is reused across many calls.`},{slug:`safety`,page:`Safety & Idempotency`,id:`observability-does-not-leak-secrets`,heading:`Observability does not leak secrets`,text:`Events never contain request or response bodies or headers. The fetch wrapper labels events METHOD origin+path: query strings, fragments and URL credentials are stripped, and retried responses are described only by status (HTTP 503). Error objects are passed through as-is, so if your errors embed sensitive data, scrub them in your onEvent handler. Exceptions and rejections from onEvent are swallowed so telemetry can never change retry behaviour.`},{slug:`fetch`,page:`The fetch Wrapper`,id:`what-it-decides-for-you`,heading:`What it decides for you`,text:`Request Retried? GET, HEAD, OPTIONS, PUT, DELETE, TRACE Yes. These are idempotent per RFC 9110 §9.2.2. POST, PATCH, anything else No, unless you opt in. Request with a stream body Sent once. A stream cannot be replayed.`},{slug:`fetch`,page:`The fetch Wrapper`,id:`retrying-a-post`,heading:`Retrying a POST`,text:`You have three explicit options:`},{slug:`fetch`,page:`The fetch Wrapper`,id:`statuses-and-retry-after`,heading:`Statuses and Retry-After`,text:`retryStatuses defaults to 408, 429, 500, 502, 503, 504. Retry-After is honoured on 429 and 503, as a floor on the wait, and a delay above maxServerDelayMs (default 30 s) abandons the retry. Other 4xx responses are returned unretried. Pass retry: false on a single request to bypass retrying entirely, or retry: { maxAttempts, totalTimeoutMs, attemptTimeoutMs, retryStatuses, idempotent } to override the wrapper's defaults for that request.`},{slug:`fetch`,page:`The fetch Wrapper`,id:`behaviour-to-know-about`,heading:`Behaviour to know about`,text:`Retryable responses are not thrown. After exhausting retries on a 503, fetchWithRetry returns that response, matching fetch. Check res.ok. Thrown failures (network errors) reject with RetryError. Timeouts cover time-to-headers only. Reading the body afterwards is not bounded by attemptTimeoutMs or totalTimeoutMs. Request objects are cloned per attempt, which buffers their body in memory.`},{slug:`observability`,page:`Observability`,id:``,heading:`Observability`,text:`Every event has name, attempt (attempts started so far) and elapsedMs.`},{slug:`observability`,page:`Observability`,id:`event-order`,heading:`Event order`,text:`A failure that is retried and then succeeds produces: attempt-started → attempt-failed → retry-scheduled → attempt-started → operation-completed. Every attempt-failed is followed by either retry-scheduled or retry-abandoned. deadline-exceeded is emitted once, at the moment the deadline is detected. operation-completed is always last, and on failure carries the RetryError.`},{slug:`observability`,page:`Observability`,id:`final-failure-reporting`,heading:`Final failure reporting`,text:`retry() rejects with RetryError:`},{slug:`observability`,page:`Observability`,id:`secrets`,heading:`Secrets`,text:`Events never contain bodies or headers, and the fetch wrapper strips query strings, fragments and URL credentials from labels. Scrub your own errors in onEvent if they embed sensitive data. Exceptions and rejections from onEvent are swallowed.`},{slug:`testing`,page:`Testing & Runtimes`,id:`fakeclock`,heading:`FakeClock`,text:`retrypilot/testing ships the FakeClock used by this package's own tests. Inject it, and a deterministic random, to test retry behaviour without waiting: The playground on the home page is built the same way: it runs the real loop on a FakeClock.`},{slug:`testing`,page:`Testing & Runtimes`,id:`node-specific-api`,heading:`Node-specific API`,text:`Everything else is portable. The only Node-specific piece lives at retrypilot/node:`},{slug:`testing`,page:`Testing & Runtimes`,id:`runtime-compatibility`,heading:`Runtime compatibility`,text:`src/ (everything except node.ts) uses no Node imports or globals; this is enforced by lint rules and by a test. It avoids AbortSignal.any and AbortSignal.timeout so it works on Node 18. Checks in this repo: the full suite runs on Node, and npm run test:deno runs a smoke test of the built package under Deno. Not tested on Bun, browsers or Workers. Nothing in the code should prevent it, but that is not verified.`},{slug:`api`,page:`API Reference`,id:``,heading:`API Reference`,text:`Export From Purpose retry(op, options) retrypilot Run op with retries createRetryPolicy(defaults) retrypilot Reusable defaults; .execute(op, overrides?) RetryBudget retrypilot Shared token bucket RetryError, AttemptTimeoutError, DeadlineExceededError retrypilot Error types computeBackoff, isTransientError, systemClock retrypilot Building blocks createRetryFetch(fetch?, options?), parseRetryAfter, DEFAULTRETRYSTATUSES retrypilot/http Fetch wrapper createUnrefClock() retrypilot/node Node-only clock FakeClock retrypilot/testing Deterministic test clock All types are exported from retrypilot (Retr`},{slug:`api`,page:`API Reference`,id:`retryop-options`,heading:`retry(op, options)`,text:`op receives { attempt, signal, remainingMs }. Forward signal (for example to fetch) so abandoned work is really cancelled. Option Default Meaning idempotency required 'idempotent' or 'non-idempotent' retryNonIdempotentWhen none Declare specific errors provably safe to repeat maxAttempts 3 Attempts including the first totalTimeoutMs none Wall-clock limit for the whole call, waits included attemptTimeoutMs none Limit per attempt, clipped to the time remaining backoff 100 ms, ×2, cap 10 s, full { initialDelayMs, factor, maxDelayMs, jitter } maxServerDelayMs 30000 Largest server-directed delay hon`},{slug:`api`,page:`API Reference`,id:`retrybudget`,heading:`RetryBudget`,text:`new RetryBudget({ capacity = 10, retryCost = 1, successRefund = 0.1, refillPerSecond = 0 }). Methods: available, tryAcquire(), recordSuccess().`},{slug:`api`,page:`API Reference`,id:`retryerror`,heading:`RetryError`,text:`reason, attempts, elapsedMs, cause, result. See Observability.`},{slug:`limitations`,page:`Limitations`,id:``,heading:`Limitations`,text:`Retries cannot fix a persistent failure and can amplify load during an outage. Use budget, jitter and a deadline. Idempotency declarations are trusted. Marking a non-idempotent operation idempotent defeats the safeguard. Likewise Idempotency-Key mode is only safe if your server really de-duplicates. fetch timeouts cover time-to-headers only. Once a response is returned, the retry layer is finished. Reading its body is not bounded by attemptTimeoutMs or totalTimeoutMs. The wrapper hands fetch its own per-attempt signal, so aborting your signal after the response has been returned does not cance`},{slug:`comparison`,page:`Comparison`,id:``,heading:`Comparison`,text:`Checked against the READMEs and type definitions of the current npm versions on 2026-10-29: p-retry 8.0.1, ky 2.2.0, got 16.1.0, cockatiel 4.0.0. If you spot an inaccuracy, please open an issue. p-retry ky got cockatiel retrypilot Scope any promise-returning function its own HTTP client its own HTTP client (Node) generic resilience policies any async function + any fetch Exponential backoff yes yes (delay fn) yes yes yes Jitter randomize (×1–2) jitter noise yes none / full / equal Retry-After not documented yes yes not documented yes (on 429/503) Cancellation via AbortSignal yes not checked no`},{slug:`comparison`,page:`Comparison`,id:`what-retrypilot-actually-adds`,heading:`What retrypilot actually adds`,text:`As best I can verify: (1) a retry layer that works with any fetch or async function, so you need not adopt an HTTP client to get safe HTTP retry rules, (2) a required idempotency declaration with an explicit, key-aware opt-in for POST, (3) a budget shared across calls, and (4) one uniform event stream. Everything else here is already available elsewhere. ky and got in particular have solid, battle-tested retry support built in; if you already use either, you probably do not need this. If you need circuit breaking or bulkheads, use cockatiel (retrypilot has neither). No performance advantage is`}];export{e as pages,t as search};