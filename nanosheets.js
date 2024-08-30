export function NanoSheets(
    // The container node, will host the input, scroll helper and cells
    node,
    {
        // Data to edit, in the format x_y:String, for example data={"0_0":"Top left cell content"}
        data = {},
        afterDataChange = () => null,
        beforeRedraw = () => null,
        cellWidth = 200,
        cellHeight = 40,
        readOnly = false,
        // The input creates the floating blue border effect and gets user key presses
        inputStyle = {
            font: "inherit",
            border: "2px solid #00aae1",
            borderRadius: "2px",
            // Carefull here, don't exceed 200ms or the selection of cells in large datasets will be buggy
            transition: "left 0.2s, top 0.2s",
            padding: "0 8px",
        },
        // The cells only display data and aren't directly editable
        cellStyle = (x, y, value, selected) => ({
            padding: "0 10px",
            // That's the grid border
            borderBottom: "1px solid #dadada",
            borderRight: "1px solid #dadada",
            // When you select a cell, it's highlighted in light blue
            background: selected ? "#e2f7ff" : "white",
            transition: "background 0.1s",
            color: "black",
            outline: "none",
            whiteSpace: "nowrap",
        }),
        containerStyle = {
            overflow: "auto",
            position: "relative",
            border: "1px solid #dadada",
        }
    },
) {
    const originalStyle = node.getAttribute('style') || '';
    Object.assign(node.style, containerStyle);
    // // The node itself shouldn't get focus, despite being scrollable and clickable
    node.setAttribute("tabindex", "-1");

    const cellXY = (cell) => cell.split("_").map((v) => parseInt(v));

    // Tracks the size of the container node
    let width, height = 0;
    // Whether input should go to "editing" cell
    let editActive = false;
    let cursor = [0, 0];
    let selection = null;

    // node.children[0] is the input we write in / focus
    const input = document.createElement("input");
    // https://stackoverflow.com/a/53126190/3597869
    input.setAttribute("type", "search");

    Object.assign(
        input.style,
        {
            zIndex: 2,
            lineHeight: cellHeight + "px",
            width: cellWidth + "px",
            height: cellHeight + "px",
            position: "absolute",
            boxSizing: "border-box",
        },
        inputStyle,
    );
    node.appendChild(input);

    // node.children[1] is the div making scroll easier
    const sizer = document.createElement("div");
    sizer.style.pointerEvents = "none";
    sizer.style.position = "absolute";
    sizer.style.width = "1px";
    sizer.style.height = "1px";

    node.appendChild(sizer);
    // This is used to make the scrollable area bigger, but also to quickly go to the "left" of the dataset
    const dataSize = [0, 0];

    function makeScrollEasier(changed) {
        // Put a min width and height to make scrolling easier
        Object.keys(changed).forEach((key) => {
            const coord = cellXY(key);
            if (coord[0] > dataSize[0]) dataSize[0] = coord[0];
            if (coord[1] > dataSize[1]) dataSize[1] = coord[1];
        });
        sizer.style.left = dataSize[0] * cellWidth + "px";
        sizer.style.top = dataSize[1] * cellHeight + "px";
    }

    makeScrollEasier(data);

    function resizeGrid() {
        const viewPortSize = node.getBoundingClientRect();
        width = Math.ceil(viewPortSize.width / cellWidth) + 1;
        height = Math.ceil(viewPortSize.height / cellHeight) + 1;
        const requiredCells = width * height;
        while (node.children.length - 2 < requiredCells) {
            const cell = document.createElement("div");
            node.appendChild(cell);
        }
        while (node.children.length - 2 > requiredCells) {
            node.removeChild(node.children[2]);
        }
    }

    function redraw() {
        const leftStart = Math.floor(node.scrollLeft / cellWidth);
        const topStart = Math.floor(node.scrollTop / cellHeight);

        beforeRedraw(cursor, selection, editActive);

        const [ex, ey] = cursor;
        Object.assign(
            input.style,
            {
                position: "absolute",
                left: cellWidth * ex + "px",
                top: cellHeight * ey + "px",
            },
            editActive
                ? {
                    background: "white",
                    color: "black",
                    pointerEvents: "all",
                }
                : {
                    background: "transparent",
                    color: "transparent",
                    pointerEvents: "none",
                },
        );
        if (readOnly) input.setAttribute("readonly", "");
        else input.removeAttribute("readonly", "");

        resizeGrid();

        const [x1, y1, x2, y2] = selection || [-1, -1, -1, -1];

        for (let dx = 0; dx < width; dx++) {
            for (let dy = 0; dy < height; dy++) {
                const x = leftStart + dx;
                const y = topStart + dy;
                const cell = x + "_" + y;
                const div = node.children[dy * width + dx + 2];
                div.style = "";
                Object.assign(div.style, {
                    lineHeight: cellHeight + "px",
                    position: "absolute",
                    boxSizing: "border-box",
                    overflow: "hidden",
                    left: cellWidth * x + "px",
                    top: cellHeight * y + "px",
                    width: cellWidth + "px",
                    height: cellHeight + "px",
                    ...cellStyle(
                        x,
                        y,
                        data[cell] || "",
                        betweenIncluded(x, x1, x2) && betweenIncluded(y, y1, y2),
                    ),
                });

                div.textContent = data[cell] || "";
                div.setAttribute("cell", cell);
            }
        }
    }

    const listeners = [];
    const ro = new ResizeObserver(redraw);

    function destroy() {
        listeners.forEach(({node, args}) => node.removeEventListener(...args));
        ro.unobserve(node);
        node.innerHTML = ''
        node.setAttribute('style', originalStyle)
    }

    function listen(node, ...args) {
        node.addEventListener(...args);
        listeners.push({node, args});

    }

    ro.observe(node);
    listen(node, "scroll", redraw);
    redraw();

    function changeData(changes) {
        if (readOnly) return;
        let hasChanged = false;
        for (const cell in changes) {
            if ((data[cell] || "") !== (changes[cell] || "")) {
                if (changes[cell] !== "") {
                    data[cell] = changes[cell];
                } else {
                    delete data[cell];
                }
                hasChanged = true;
            }
        }
        if (hasChanged) {
            afterDataChange();
            makeScrollEasier(changes);
        }
    }

    listen(input, "focus", () => {
        // Editor got focused
        if (!selection) {
            const [x, y] = cursor;
            selection = [x, y, x, y];
            redraw();
        }
    });

    listen(input, "blur", () => {
        // Editor lost focus
        stopEditing();
        selection = null;
        redraw();
    });

    function saveEditedValue() {
        if (editActive) {
            changeData({[cursor.join("_")]: input.value});
        }
    }

    listen(
        input,
        "keydown",
        (e) => {
            const [x, y] = cursor;

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
                End: [dataSize[0] - x, 0],
            };
            const shiftBy = coords[e.key];

            if (e.key === "Delete" || e.key === "Backspace") {
                clearSelectedCellsContent();
                redraw();
            } else if (shiftBy) {
                stopEditing();
                const [dx, dy] = shiftBy;
                if (e.shiftKey) {
                    selection[2] = Math.max(0, selection[2] + dx);
                    selection[3] = Math.max(0, selection[3] + dy);
                    scrollTo(selection[2], selection[3]);
                } else {
                    select(Math.max(0, x + dx), Math.max(0, y + dy));
                }
                redraw();
            }
        },
        true,
    );

    listen(input, "input", (e) => {
        if (!editActive && input.value) {
            const tmp = input.value;
            startEditing(...cursor);
            input.value = tmp;
            redraw();
        }
    });

    function scrollTo(x, y) {
        const {width, height} = node.getBoundingClientRect();
        if (node.scrollLeft + width < (x + 1) * cellWidth) {
            node.scrollLeft = (x + 1) * cellWidth - width;
        } else if (x * cellWidth < node.scrollLeft) {
            node.scrollLeft = x * cellWidth;
        }
        if (node.scrollTop + height < (y + 1) * cellHeight) {
            node.scrollTop = (y + 1) * cellHeight - height;
        } else if (y * cellHeight < node.scrollTop) {
            node.scrollTop = y * cellHeight;
        }
    }

    function select(x, y) {
        cursor = [x, y];
        selection = [x, y, x, y];
        redraw();
        scrollTo(x, y);
    }

    function stopEditing() {
        if (editActive) {
            saveEditedValue();
            editActive = false;
            // This avoids the remaining text showing up when you select it with shift + arrows
            input.value = "";
        }
    }

    function startEditing(x, y) {
        const cell = [x, y].join("_");
        if (!editActive || cursor[0] !== x || cursor[1] !== y) {
            cursor = [x, y];
            input.value = data[cell] || "";
            editActive = true;
        }
        redraw();
    }

    let lastClick = 0;
    listen(
        node,
        "mousedown",
        (e) => {
            const cell = e.target.getAttribute("cell");
            if (!cell || e.buttons !== 1) return;
            e.preventDefault();

            const [x, y] = cellXY(cell);
            if (cell === cursor.join("_")) {
                //  Double click happened
                if (Date.now() - 400 < lastClick && !readOnly) {
                    startEditing(x, y);
                }
            } else {
                stopEditing();

                select(x, y);
                setTimeout(() => input.focus(), 200);
                lastClick = Date.now();
            }

            redraw();
        },
        true,
    );

    let lasttouchstart = null
    listen(
        node,
        "touchstart",
        (e) => {
            lasttouchstart = e.target.getAttribute("cell");
            // e.preve
        },
        true,
    );

    listen(
        node,
        "touchend",
        (e) => {
            const cell = e.target.getAttribute("cell")
            if (cell === lasttouchstart) {

                // e.preventDefault();
                const [x, y] = cellXY(cell);
                if (cell === cursor.join("_") && !readOnly) {
                    startEditing(x, y);
                    setTimeout(() => {
                        input.select()
                        input.focus()
                    }, 200);
                } else {
                    input.blur()
                    stopEditing();
                    select(x, y);
                }
            }
            ;
        },
        true,
    );


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
        const [dx, dy] = cursor;
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
            clearSelectedCellsContent();
            redraw();
        }
    });

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
        return (
            value >= Math.min(bound1, bound2) && value <= Math.max(bound1, bound2)
        );
    }

    return {
        // Call this to remove listeners
        destroy,
        // Scroll a specific cell into view
        scrollTo,
        // Select a specific cell
        select,
        // Redraw  the view after you changed the data or style
        redraw() {
            redraw();
            makeScrollEasier(data);
        },
        data,
        set readOnly(value) {
            readOnly = value;
            redraw();
        },
    };
}
