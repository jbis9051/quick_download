const Mousetrap = require('mousetrap');

module.exports = function (elements) {
    const callbacks = [];

    function nest(elements) {

        const output = [];

        elements.forEach(i => {
            if (i.content instanceof Array)
                output.push(`<div class="menu-item submenu">${i.label}
                <div class="submenu-wrapper">${nest(i.content)}</div>
            </div>`);
            else {
                if (typeof i.content === "function") {
                    if (i.shortcut)
                        Mousetrap.bind(i.shortcut, i.content);

                    callbacks.push(i.content);
                    output.push(`<div data-callback-index="${callbacks.length - 1}" class="menu-item action">
                            ${i.label}
                            <span class="shortcut">${(i.shortcut instanceof Array ? i.shortcut.join(", ") : i.shortcut || "")}</span>
                        </div>`);
                } else if (i.content === "separator") {
                    output.push(`<hr/>`)
                }
            }
        });

        // return `<div class="menu-box">${output.join('')}</div>`;
        return output.join("");
    }

    const element = document.createElement('div');
    element.innerHTML = nest(elements);

    [...element.querySelectorAll(".menu-item.action")].forEach(i => {
        const callback = callbacks[Number(i.dataset.callbackIndex)];
        i.addEventListener("click", callback);
    });

    return element;
};
