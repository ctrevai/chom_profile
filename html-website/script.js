function toggleMenu() {
    const menu = document.querySelector('.menu-links');
    const icon = document.querySelector('.hamburger-icon');
    menu.classList.toggle('open');
    icon.classList.toggle('open');
}

function updateCopyrightYear() {
    let currentYear = new Date().getFullYear();
    document.getElementById('copyright').innerHTML = 'Copyright &#169; ' + currentYear + ' Chom Trevai. All Rights Reserved.';
}

updateCopyrightYear();