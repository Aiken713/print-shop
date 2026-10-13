// Color themes. Each theme has two main colors:
//   paper = page background, ink = text, buttons and the product band.
// To tweak a color, change the hex code. To add a theme, copy a line.
(function () {
  var THEMES = [
    { id: 'fir',      name: 'Sulu & Deep Fir',            paper: '#C9F27E', ink: '#0B3B25', hover: '#06261A', field: '#F0FBD6', fieldInk: '#06261A', soft: '#B2DC63', backdrop: 'rgba(11,59,37,.78)' },
    { id: 'red',      name: 'Machine Red & Glacier Blue', paper: '#CFE6F2', ink: '#B81D24', hover: '#8E1218', field: '#EEF7FB', fieldInk: '#4F0D11', soft: '#B5D3E3', backdrop: 'rgba(184,29,36,.75)' },
    { id: 'pink',     name: 'Dark Aubergine & Electric Pink', paper: '#2D0A31', ink: '#FF4DA6', hover: '#FF80BF', field: '#431649', fieldInk: '#FFD9EC', soft: '#4A1B51', backdrop: 'rgba(20,0,24,.82)' },
    { id: 'orange',   name: 'Neon Orange & Charcoal',     paper: '#FF6A1F', ink: '#1E2023', hover: '#2A2D31', field: '#FFE6D6', fieldInk: '#1E2023', soft: '#E85A12', backdrop: 'rgba(30,32,35,.8)' },
    { id: 'teal',     name: 'Cyber Teal & Aqua Foam',     paper: '#D3F6EF', ink: '#00756E', hover: '#005650', field: '#EEFCF9', fieldInk: '#00423E', soft: '#B7E8DE', backdrop: 'rgba(0,117,110,.75)' },
    { id: 'original', name: 'Original (Blue & Cream)',    paper: '#F5E4D0', ink: '#285CCC', hover: '#1F49A3', field: '#FFF8EF', fieldInk: '#12306E', soft: '#E7D2B9', backdrop: 'rgba(40,92,204,.75)' }
  ];

  function find(id) {
    return THEMES.filter(function (t) { return t.id === id; })[0] || THEMES[THEMES.length - 1];
  }

  function apply(t) {
    var s = document.documentElement.style;
    s.setProperty('--cream', t.paper);
    s.setProperty('--blue', t.ink);
    s.setProperty('--blue-dark', t.hover);
    s.setProperty('--field', t.field);
    s.setProperty('--field-ink', t.fieldInk);
    s.setProperty('--soft', t.soft);
    s.setProperty('--backdrop', t.backdrop);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', t.ink);
  }

  var saved = null;
  try { saved = localStorage.getItem('theme'); } catch (e) {}
  var current = find(saved);
  apply(current);

  document.addEventListener('DOMContentLoaded', function () {
    var box = document.createElement('details');
    box.className = 'themes';
    var label = document.createElement('summary');
    label.textContent = 'Theme';
    var menu = document.createElement('div');
    menu.className = 'theme-menu';
    box.appendChild(label);
    box.appendChild(menu);

    THEMES.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      var sw = document.createElement('span');
      sw.className = 'sw';
      sw.style.setProperty('--a', t.paper);
      sw.style.setProperty('--b', t.ink);
      var txt = document.createElement('span');
      txt.textContent = t.name;
      b.appendChild(sw);
      b.appendChild(txt);
      if (t.id === current.id) b.setAttribute('aria-current', 'true');
      b.addEventListener('click', function () {
        current = t;
        apply(t);
        try { localStorage.setItem('theme', t.id); } catch (e) {}
        Array.prototype.forEach.call(menu.children, function (c) { c.removeAttribute('aria-current'); });
        b.setAttribute('aria-current', 'true');
        box.open = false;
      });
      menu.appendChild(b);
    });

    document.body.appendChild(box);
    document.addEventListener('click', function (e) { if (!box.contains(e.target)) box.open = false; });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') box.open = false; });
  });
})();
