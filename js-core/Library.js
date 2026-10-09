// ==========================================
// HOME PAGE
// Builds one card per entry in tools.json (path, icon, title, description)
// ==========================================
const grid = document.getElementById('tools-grid');
const tools = await fetch('tools.json').then(r => r.json());

tools.forEach(tool => {
    const card = document.createElement('a');
    card.href = tool.path + 'index.html';
    card.className = 'tool-card';
    card.innerHTML = '<div class="card-icon"></div><h2></h2><p></p>';
    card.querySelector('.card-icon').textContent = tool.icon;
    card.querySelector('h2').textContent = tool.title;
    card.querySelector('p').textContent = tool.description;
    grid.appendChild(card);
});
