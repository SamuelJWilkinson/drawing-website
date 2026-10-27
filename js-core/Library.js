// ==========================================
// HOME PAGE
// Builds one section per category in tools.json, with one card per tool
// (category, path, icon, title, description)
// ==========================================
const library = document.getElementById('library');
const tools = await fetch('tools.json').then(r => r.json());

const sections = {}; // category name -> the grid its cards go in

tools.forEach(tool => {
    if (!sections[tool.category]) {
        const heading = document.createElement('h2');
        heading.className = 'category-heading';
        heading.textContent = tool.category;
        const grid = document.createElement('div');
        grid.className = 'tools-grid';
        library.append(heading, grid);
        sections[tool.category] = grid;
    }

    const card = document.createElement('a');
    card.href = tool.path + 'index.html';
    card.className = 'tool-card';
    card.innerHTML = '<div class="card-icon"></div><h2></h2><p></p>';
    card.querySelector('.card-icon').textContent = tool.icon;
    card.querySelector('h2').textContent = tool.title;
    card.querySelector('p').textContent = tool.description;
    sections[tool.category].appendChild(card);
});
