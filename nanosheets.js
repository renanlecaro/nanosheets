export function NanoSheets(
    node,
    {
        data = {},
        onChange = () => null,
        cellWidth = 200,
        cellHeight = 40,
        selectedStyle = {
            background: "lightblue",
        },
        editingStyle = {
            border: "2px solid #0a7ea4",
            zIndex: 1,
        },
        editingActiveStyle = {
            background: "white",
        },
        baseStyle = {
            position: "absolute",
            padding: "0 10px",
            boxSizing: "border-box",
            border: "1px solid #dadada",
        },
    },
) {
    Object.assign(node.style, {overflow: "auto", position: "relative"});
    // So that we get key events even when no input is focused
    node.setAttribute("tabindex", "0");
    let width,
        height = 0;
    const cellXY = (cell) => cell.split("_").map((v) => parseInt(v));

    // Whether input should go to "editing" cell
    let editActive = false;
    let editing = null;
    let selection = null;

    function resizeGrid() {
        const viewPortSize = node.getBoundingClientRect();
        width = Math.ceil(viewPortSize.width / cellWidth) + 1;
        height = Math.ceil(viewPortSize.height / cellHeight) + 1;
        const requiredCells = width * height;
        while (node.children.length < requiredCells) {
            const input = document.createElement("input");
            input.setAttribute("type", "text");
            node.appendChild(input);
        }
        while (node.children.length > requiredCells) {
            node.removeChild(node.children[0]);
        }
    }

    function redraw() {
        resizeGrid()
        const leftStart = Math.ceil(node.scrollLeft / cellWidth) - 1;
        const topStart = Math.ceil(node.scrollTop / cellHeight) - 1;
        for (let dx = 0; dx < width; dx++) {
            for (let dy = 0; dy < height; dy++) {
                const x = leftStart + dx;
                const y = topStart + dy;
                const cell = x + "_" + y;
                const input = node.children[dy * width + dx];
                input.style = "";
                Object.assign(input.style, {
                    ...baseStyle,
                    lineHeight: cellHeight,
                    left: cellWidth * x + "px",
                    top: cellHeight * y + "px",
                    width: cellWidth + "px",
                    height: cellHeight + "px",
                });

                if (selection) {
                    const [x1, y1, x2, y2] = selection;
                    if (betweenIncluded(x, x1, x2) && betweenIncluded(y, y1, y2)) {
                        Object.assign(input.style, selectedStyle);
                    }
                }
                if (editing === cell) {
                    Object.assign(input.style, editingStyle);
                    if (editActive) Object.assign(input.style, editingActiveStyle);
                }

                if (editing === cell && editActive) input.removeAttribute("readonly");
                else {
                    input.setAttribute("readonly", "");
                }

                input.value = data[cell] || "";
                input.setAttribute("cell", cell);
            }
        }
    }

    const ro = new ResizeObserver(redraw)
    ro.observe(node);

    const listeners = []

    function destroy() {
        listeners.forEach(({node, type, callback}) => node.removeEventListener(type, callback))
        ro.unobserve(node)
    }

    function listen(node, type, callback) {
        node.addEventListener(type, callback)
        listeners.push({node, type, callback})
    }

    listen(node, "scroll", redraw);
    redraw();

    function changeData(changes) {
        let hasChanged = false;
        for (const cell in changes) {
            if ((data[cell] || "") !== (changes[cell] || "")) {
                if (changes[cell]) {
                    data[cell] = changes[cell];
                } else {
                    delete data[cell];
                }
                hasChanged = true;
            }
        }
        if (hasChanged) {
            onChange(data);
        }
    }

    listen(node, "blur", (e) => {
        if (e.target.getAttribute("cell") === editing && editActive) {
            editActive = false;
            redraw();
        }
    });

    function saveEditedValue() {
        if (editing && editActive) {
            const input = node.querySelector('input[cell="' + editing + '"]');
            if (input) {
                changeData({[editing]: input.value});
                redraw();
            }
        }
    }

    listen(node, "change", saveEditedValue);

    listen(node, "keydown",
        (e) => {
            if (e.ctrlKey) return;
            const [x, y] = cellXY(editing);
            if (e.key === "Enter") {
                changeData({[e.target.getAttribute("cell")]: e.target.value});
                select(x, y + 1);
            } else if (
                !editing ||
                !editActive ||
                e.target.getAttribute("cell") !== editing
            ) {
                if (e.key === "ArrowRight") {
                    if (e.shiftKey) {
                        selection[2]++;
                        scrollIntoView(selection[2], selection[3])
                    } else {
                        select(x + 1, y);
                    }
                } else if (e.key === "ArrowLeft") {
                    if (e.shiftKey) {
                        selection[2] = Math.max(0, selection[2] - 1);
                        scrollIntoView(selection[2], selection[3])
                    } else {
                        select(Math.max(0, x - 1), y);
                    }
                } else if (e.key === "ArrowDown") {
                    if (e.shiftKey) {
                        selection[3]++;
                        scrollIntoView(selection[2], selection[3])
                    } else {
                        select(x, y + 1);
                    }
                } else if (e.key === "ArrowUp") {
                    if (e.shiftKey) {
                        selection[3] = Math.max(0, selection[3] - 1);
                        scrollIntoView(selection[2], selection[3])
                    } else {
                        select(x, Math.max(0, y - 1));
                    }
                } else if (editing && (e.key.length === 1 || e.key === "Backspace")) {
                    changeData({[editing]: ""});
                    startEditing(x, y);
                    return;
                }
                redraw();
            }
        },
        true,
    );

    function select(x, y) {
        saveEditedValue();
        const cell = [x, y].join("_");
        editing = cell;
        selection = [x, y, x, y];
        redraw();
        node.focus();
        scrollIntoView(x, y)
    }

    function scrollIntoView(x, y) {

        node.querySelector('[cell="' + x + '_' + y + '"]')?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "nearest",
        });
    }

    function startEditing(x, y) {
        const cell = [x, y].join("_");
        editActive = true;
        editing = cell;
        redraw();
        node.querySelector('[cell="' + cell + '"]')?.focus();
    }

    let lastClick = 0;
    listen(node, "mousedown", (e) => {
        e.preventDefault();

        const cell = e.target.getAttribute("cell");
        const [x, y] = cellXY(cell);
        if (Date.now() - 200 < lastClick && cell === editing) {
            //  Double click happened
            startEditing(x, y);
        } else {
            saveEditedValue()
            editActive = false
            lastClick = Date.now();
            if (cell !== editing) {
                select(x, y);
            }
        }
        redraw()
    });

    listen(node,
        "mouseenter",
        (e) => {
            if (e.buttons === 1 && selection) {
                const cell = e.target.getAttribute("cell");
                if (selection) {
                    const [x, y] = cellXY(cell);
                    selection[2] = x;
                    selection[3] = y;
                    redraw();
                }
            }
        },
        true,
    );

    listen(window, "paste", (e) => {
        if (editActive || !selection) return;
        e.preventDefault();
        const rows = parseArrayString(
            (e.clipboardData || window.clipboardData).getData("text/plain"),
        );
        const change = {};
        const [dx, dy] = cellXY(editing);
        rows.forEach((row, y) =>
            row.forEach((value, x) => (change[dx + x + "_" + (dy + y)] = value)),
        );
        changeData(change);
        selection = [dx, dy, dx + rows[0].length - 1, dy + rows.length - 1];
        redraw();
    });

    function copySelectedToClipboardEvent(e) {

        e.preventDefault();
        const [x1, y1, x2, y2] = selection;
        const asArr = [];
        for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
            const line = [];
            for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
                line.push(data[x + "_" + y] || "");
            }
            asArr.push(line);
        }
        e.clipboardData.setData("text/plain", stringifyArray(asArr));

    }

    listen(window, "copy", (e) => {

        if (!editActive && selection) {

            copySelectedToClipboardEvent(e)
        }
    });
    listen(window, "cut", (e) => {
        if (!editActive && selection) {
            copySelectedToClipboardEvent(e)
            const change = {}
            const [x1, y1, x2, y2] = selection;
            for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
                for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
                    change[x + '_' + y] = ''
                }
            }
            changeData(change)
            redraw()
        }
    });

    listen(node, "blur", () => {
        selection = null;
        redraw();
    });


    return {
        redraw,
        resizeGrid,
        data,
        select,
        startEditing,
    };
}

// from https://github.com/warpech/sheetclip/blob/master/sheetclip.js

function countQuotes(str) {
    return str.split('"').length - 1;
}

function parseArrayString(str) {
    var r,
        rlen,
        rows,
        arr = [],
        a = 0,
        c,
        clen,
        multiline,
        last;
    rows = str.split("\n");
    if (rows.length > 1 && rows[rows.length - 1] === "") {
        rows.pop();
    }
    for (r = 0, rlen = rows.length; r < rlen; r += 1) {
        rows[r] = rows[r].split("\t");
        for (c = 0, clen = rows[r].length; c < clen; c += 1) {
            if (!arr[a]) {
                arr[a] = [];
            }
            if (multiline && c === 0) {
                last = arr[a].length - 1;
                arr[a][last] = arr[a][last] + "\n" + rows[r][0];
                if (multiline && countQuotes(rows[r][0]) & 1) {
                    //& 1 is a bitwise way of performing mod 2
                    multiline = false;
                    arr[a][last] = arr[a][last]
                        .substring(0, arr[a][last].length - 1)
                        .replace(/""/g, '"');
                }
            } else {
                if (
                    c === clen - 1 &&
                    rows[r][c].indexOf('"') === 0 &&
                    countQuotes(rows[r][c]) & 1
                ) {
                    arr[a].push(rows[r][c].substring(1).replace(/""/g, '"'));
                    multiline = true;
                } else {
                    arr[a].push(rows[r][c].replace(/""/g, '"'));
                    multiline = false;
                }
            }
        }
        if (!multiline) {
            a += 1;
        }
    }
    return arr;
}

function stringifyArray(arr) {
    var r,
        rlen,
        c,
        clen,
        str = "",
        val;
    for (r = 0, rlen = arr.length; r < rlen; r += 1) {
        for (c = 0, clen = arr[r].length; c < clen; c += 1) {
            if (c > 0) {
                str += "\t";
            }
            val = arr[r][c];
            if (typeof val === "string") {
                if (val.indexOf("\n") > -1) {
                    str += '"' + val.replace(/"/g, '""') + '"';
                } else {
                    str += val;
                }
            } else if (val === null || val === void 0) {
                //void 0 resolves to undefined
                str += "";
            } else {
                str += val;
            }
        }
        str += "\n";
    }
    return str;
}

function betweenIncluded(value, bound1, bound2) {
    return value >= Math.min(bound1, bound2) && value <= Math.max(bound1, bound2);
}
