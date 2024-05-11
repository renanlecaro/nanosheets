export function NanoSheets(
    node,
    {
        data = {},
        onChange = () => null,
        cellWidth = 200,
        cellHeight = 40,
        style = ({x, y, value, selected, cursor}) => ({
            padding: "0 10px",
            border: cursor ? "2px solid #0a7ea4" : "1px solid #dadada",
            background: selected ? 'lightblue' : 'white',
            color: 'black'
        }),
        defaultValue = ({x, y}) => ''
    },
) {

    Object.assign(node.style, {overflow: "auto", position: "relative"});
    // // The node itself shouldn't get focus, despite being scrollable and clickable
    node.setAttribute('tabindex', '-1')

    let width,
        height = 0;

    const cellXY = (cell) => cell.split("_").map((v) => parseInt(v));

    // Whether input should go to "editing" cell
    let editActive = false;
    let editing = '0_0';
    let selection = null;

    // node.children[0] is the input we write in / focus
    const input = document.createElement('input')
    input.setAttribute("type", "text");
    Object.assign(input.style, {
        font: 'inherit',
        zIndex: 2,
        lineHeight: cellHeight + 'px',
        position: "absolute",
        width: cellWidth + "px",
        height: cellHeight + "px",
        boxSizing: 'border-box',
        border: 'none'
    })
    node.appendChild(input)

    function resizeGrid() {
        const viewPortSize = node.getBoundingClientRect();
        width = Math.ceil(viewPortSize.width / cellWidth) + 1;
        height = Math.ceil(viewPortSize.height / cellHeight) + 1;
        const requiredCells = width * height;
        while (node.children.length - 1 < requiredCells) {
            const cell = document.createElement("div");
            node.appendChild(cell);
        }
        while (node.children.length - 1 > requiredCells) {
            node.removeChild(node.children[1]);
        }
    }

    function redraw() {
        const [ex, ey] = cellXY(editing)
        Object.assign(input.style, {
            left: cellWidth * ex + "px",
            top: cellHeight * ey + "px",
            opacity: editActive ? 1 : 0,
            pointerEvents: editActive ? 'all' : 'none'

        })

        resizeGrid();
        const leftStart = Math.floor(node.scrollLeft / cellWidth);
        const topStart = Math.floor(node.scrollTop / cellHeight);

        const [x1, y1, x2, y2] = selection || [-1, -1, -1, -1,];

        for (let dx = 0; dx < width; dx++) {
            for (let dy = 0; dy < height; dy++) {
                const x = leftStart + dx;
                const y = topStart + dy;
                const cell = x + "_" + y;
                const div = node.children[dy * width + dx + 1];
                div.style = "";
                Object.assign(div.style, {
                    lineHeight: cellHeight + 'px',
                    position: "absolute",
                    boxSizing: "border-box",
                    overflow: "hidden",
                    left: cellWidth * x + "px",
                    top: cellHeight * y + "px",
                    width: cellWidth + "px",
                    height: cellHeight + "px",
                    ...style({
                        x,
                        y,
                        value: data[cell] || defaultValue({x, y}),
                        selected: betweenIncluded(x, x1, x2) && betweenIncluded(y, y1, y2),
                        cursor: editing === cell,
                    }),
                });

                div.textContent = data[cell] || defaultValue({x, y});
                div.setAttribute("cell", cell);
            }
        }
    }

    const listeners = [];
    const ro = new ResizeObserver(redraw);

    function destroy() {
        listeners.forEach(({node, args}) =>
            node.removeEventListener(...args),
        );
        ro.unobserve(node);
        [node.children].forEach(n => n.parentElement.remove(n))
        node.style = ''
    }

    function listen(node, ...args) {
        node.addEventListener(...args);
        listeners.push({node, args});
    }

    ro.observe(node);
    listen(node, "scroll", redraw);
    redraw();

    function changeData(changes) {
        let hasChanged = false;
        for (const cell in changes) {
            const [x, y] = cellXY(cell)
            if ((data[cell] || "") !== (changes[cell] || "")) {
                if (changes[cell] !== defaultValue({x, y})) {
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


    listen(input, "focus", () => {
        // Editor got focused
        if (editing && !selection) {
            const [x, y] = cellXY(editing)
            selection = [x, y, x, y]
            redraw();
        }
    });


    listen(input, "blur", () => {
        // Editor lost focus
        selection = null;
        editActive = false;
        redraw();
    });

    function saveEditedValue() {
        if (editActive) {
            changeData({[editing]: input.value});
        }
    }


    listen(
        input,
        "keydown",
        (e) => {
            if (e.ctrlKey) return;
            const [x, y] = cellXY(editing);
            if (e.key === "Enter") {
                stopEditing()
                select(x, y + 1)
            } else if (
                !editActive
            ) {
                if (e.key === "ArrowRight") {
                    if (e.shiftKey) {
                        selection[2]++;
                        scrollIntoView(selection[2], selection[3]);
                    } else {
                        select(x + 1, y);
                    }
                } else if (e.key === "ArrowLeft") {
                    if (e.shiftKey) {
                        selection[2] = Math.max(0, selection[2] - 1);
                        scrollIntoView(selection[2], selection[3]);
                    } else {
                        select(Math.max(0, x - 1), y);
                    }
                } else if (e.key === "ArrowDown") {
                    if (e.shiftKey) {
                        selection[3]++;
                        scrollIntoView(selection[2], selection[3]);
                    } else {
                        select(x, y + 1);
                    }
                } else if (e.key === "ArrowUp") {
                    if (e.shiftKey) {
                        selection[3] = Math.max(0, selection[3] - 1);
                        scrollIntoView(selection[2], selection[3]);
                    } else {
                        select(x, Math.max(0, y - 1));
                    }
                } else if (editing && (e.key.length === 1 || e.key === "Backspace")) {
                    startEditing(x, y);
                    input.value = ''

                }
                redraw();
            }
        },
        true,
    );

    function select(x, y) {
        const cell = [x, y].join("_");
        editing = cell;
        selection = [x, y, x, y];
        redraw();
        input.focus();
        scrollIntoView(x, y);
    }

    function scrollIntoView(x, y) {
        node.querySelector('[cell="' + x + "_" + y + '"]')?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "nearest",
        });
    }

    function stopEditing() {
        if (editActive) {
            saveEditedValue();
            editActive = false;
        }
    }

    function startEditing(x, y) {

        const cell = [x, y].join("_");
        if (!editActive || editing !== cell) {
            editing = cell;
            input.value = data[cell] || defaultValue({x, y})
            editActive = true;
        }
        redraw();
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
            stopEditing()
            lastClick = Date.now();
            if (cell !== editing) {
                select(x, y);
            }
        }
        redraw();
    }, true);

    listen(
        node,
        "mouseenter",
        (e) => {
            if (e.buttons === 1 && selection) {
                const cell = e.target.getAttribute("cell");
                if (selection && cell) {
                    const [x, y] = cellXY(cell);
                    selection[2] = x;
                    selection[3] = y;
                    redraw();
                }
            }
        },
        true,
    );

    listen(input, "paste", (e) => {
        if (editActive) return;
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
                line.push(data[x + "_" + y] || defaultValue({x, y}));
            }
            asArr.push(line);
        }
        e.clipboardData.setData("text/plain", stringifyArray(asArr));
    }

    listen(input, "copy", (e) => {
        if (!editActive) {
            copySelectedToClipboardEvent(e);
        }
    });
    listen(input, "cut", (e) => {
        if (!editActive) {
            copySelectedToClipboardEvent(e);
            const change = {};
            const [x1, y1, x2, y2] = selection;
            for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
                for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
                    change[x + "_" + y] = "";
                }
            }
            changeData(change);
            redraw();
        }
    });


    return {
        // Call this to remove listeners
        destroy,
        redraw,
        data,
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
