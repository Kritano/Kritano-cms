export interface SearchComponentProps {
  placeholder?: string
  collection?: string
  resultsUrl?: string
  enhance?: boolean
}

/**
 * Generate HTML for a search form component.
 * Returns a plain HTML <form> that works without JavaScript.
 * When enhance is true, includes a defer-loaded script for live search.
 */
export function renderSearchForm(props: SearchComponentProps = {}): string {
  const {
    placeholder = 'Search...',
    collection,
    resultsUrl = '/search',
    enhance = false,
  } = props

  const formAction = collection ? `${resultsUrl}?collection=${collection}` : resultsUrl

  let html = `<form action="${formAction}" method="get" class="cms-search" data-cms-search${collection ? ` data-collection="${collection}"` : ''}>
  <input type="search" name="q" placeholder="${placeholder}" autocomplete="off" class="cms-search-input" />
  <button type="submit" class="cms-search-button" aria-label="Search">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
  </button>
</form>`

  if (enhance) {
    html += `\n<script defer>
(function(){
  var form = document.querySelector('[data-cms-search]');
  if (!form) return;
  var input = form.querySelector('input[name="q"]');
  var collection = form.dataset.collection || '';
  var timer = null;
  var dropdown = document.createElement('div');
  dropdown.className = 'cms-search-dropdown';
  dropdown.style.cssText = 'display:none;position:absolute;top:100%;left:0;right:0;background:#fff;border:1px solid #e5e7eb;border-radius:0.5rem;box-shadow:0 4px 6px -1px rgb(0 0 0/0.1);max-height:300px;overflow-y:auto;z-index:50';
  form.style.position = 'relative';
  form.appendChild(dropdown);

  input.addEventListener('input', function() {
    clearTimeout(timer);
    var q = this.value.trim();
    if (q.length < 2) { dropdown.style.display = 'none'; return; }
    timer = setTimeout(function() {
      var url = '/api/search/suggest?q=' + encodeURIComponent(q);
      if (collection) url += '&collection=' + collection;
      fetch(url).then(function(r){return r.json()}).then(function(data) {
        if (!data.suggestions || data.suggestions.length === 0) {
          dropdown.style.display = 'none'; return;
        }
        dropdown.innerHTML = data.suggestions.map(function(s) {
          return '<a href="' + form.action + '?q=' + encodeURIComponent(s) + '" style="display:block;padding:0.5rem 0.75rem;text-decoration:none;color:#111;font-size:0.875rem;border-bottom:1px solid #f3f4f6" onmouseover="this.style.background=\\'#f9fafb\\'" onmouseout="this.style.background=\\'transparent\\'">' + s + '</a>';
        }).join('');
        dropdown.style.display = 'block';
      }).catch(function(){dropdown.style.display='none'});
    }, 200);
  });

  document.addEventListener('click', function(e) {
    if (!form.contains(e.target)) dropdown.style.display = 'none';
  });
})();
</script>`
  }

  return html
}
