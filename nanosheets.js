export function NanoSheets(
    node,
    {
        data = {},
        onChange = () => null,
        cellWidth = 200,
        cellHeight = 40,
        style = ({x, y, value, selected}) => ({
            padding: "0 10px",
            borderBottom: "1px solid #dadada",
            borderRight: '1px solid #dadada',
            background: selected ? '#e2f7ff' : 'white',
            transition: 'background 0.1s',
            color: 'black',
            outline: 'none',
            whiteSpace: 'nowrap'
        }),
        defaultValue = ({x, y}) => ''
    },
) {

    Object.assign(node.style, {overflow: "auto", position: "relative", border: '1px solid #dadada'});
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
    // https://stackoverflow.com/a/53126190/3597869
    input.setAttribute("type", "search");
    Object.assign(input.style, {
        zIndex: 2,
        font: 'inherit',
        lineHeight: cellHeight + 'px',
        width: cellWidth + "px",
        height: cellHeight + "px",
        position: "absolute",
        boxSizing: 'border-box',
        border: '2px solid #00aae1',
        borderRadius: '2px',
        transition: 'left 0.2s, top 0.2s',
        padding: '0 8px',
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
            background: editActive ? 'white' : 'transparent',
            color: editActive ? 'black' : 'transparent',
            pointerEvents: editActive ? 'all' : 'none',
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
        [node.children].forEach(n => n.remove())
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
        stopEditing()
        selection = null;
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

            const [x, y] = cellXY(editing);

            const allCells = Object.keys(data).map(cell => cellXY(cell))
            const xMax = Math.max(...allCells.map(c => c[0]), x)

            // Map of keys to moves of the cursor
            const coords = {
                ArrowRight: [1, 0],
                ArrowLeft: [-1, 0],
                ArrowDown: [0, 1],
                ArrowUp: [0, -1],
                Enter: [0, 1],
                PageDown: [0, height - 1],
                PageUp: [0, -(height - 1)],
                Home: [-x, 0],
                End: [xMax - x, 0]
            };
            const shiftBy = coords[e.key]


            if (e.key === "Delete" || e.key === "Backspace") {
                clearSelectedCellsContent()
                redraw()
            } else if (shiftBy) {
                stopEditing()
                const [dx, dy] = shiftBy
                if (e.shiftKey) {
                    selection[2] = Math.max(0, selection[2] + dx);
                    selection[3] = Math.max(0, selection[3] + dy);
                    scrollTo(selection[2], selection[3]);
                } else {
                    select(Math.max(0, x + dx), Math.max(0, y + dy));
                }
                redraw();
            }
            // else if (!editActive && !e.ctrlKey && e.key.length === 1) {
            //     startEditing(x, y);
            //     input.value = ''
            //     redraw();
            // }
        },
        true,
    );

    listen(
        input,
        "input", (e) => {

            if (!editActive && input.value) {
                const [x, y] = cellXY(editing);
                const tmp = input.value
                startEditing(x, y);
                input.value = tmp
                redraw();
            }
        })

    function select(x, y) {
        editing = [x, y].join("_");
        selection = [x, y, x, y];
        redraw();
        input.focus();
        scrollTo(x, y);
    }

    function scrollTo(x, y) {
        const {width, height} = node.getBoundingClientRect()

        if (node.scrollLeft + width < (x + 1) * cellWidth) {
            node.scrollLeft = (x + 1) * cellWidth - width
        } else if (x * cellWidth < node.scrollLeft) {
            node.scrollLeft = x * cellWidth
        }
        if (node.scrollTop + height < (y + 1) * cellHeight) {
            node.scrollTop = (y + 1) * cellHeight - height
        } else if (y * cellHeight < node.scrollTop) {
            node.scrollTop = y * cellHeight
        }
    }

    function stopEditing() {
        if (editActive) {
            saveEditedValue();
            editActive = false;
            // This avoids the remaining text showing up when you select it with shift + arrows
            input.value = ''
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
        
        const cell = e.target.getAttribute("cell");
        if (!cell || e.buttons !== 1) return
        e.preventDefault();

        const [x, y] = cellXY(cell);
        if (Date.now() - 400 < lastClick && cell === editing) {
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

    function clearSelectedCellsContent() {
        const change = {};
        const [x1, y1, x2, y2] = selection;
        for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
            for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
                change[x + "_" + y] = "";
            }
        }
        changeData(change);
    }

    listen(input, "cut", (e) => {
        if (!editActive) {
            copySelectedToClipboardEvent(e);
            clearSelectedCellsContent()
            redraw();
        }
    });


    return {
        // Call this to remove listeners
        destroy,
        scrollTo,
        redraw,
        data,
    };

    // Functions declared here will be hoisted above while making it clear to uglify-js that
    // they are private


    // from https://github.com/warpech/sheetclip/blob/master/sheetclip.js
    function countQuotes(str) {
        return str.split('"').length - 1;
    }

    function parseArrayString(str) {
        let r,
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
        let r,
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

}
