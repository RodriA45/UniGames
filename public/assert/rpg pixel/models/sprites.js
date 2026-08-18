// Datos de grilla uniforme para usar con drawImage.
// Cada hoja tiene su propio array de filas (una fila = una animación/grupo).
// Uso típico:
//   const data = SPRITES.junior.rows[0]; // fila 0
//   ctx.drawImage(
//     img,
//     frameIndex * data.cellWidth, data.y,  // origen en el spritesheet
//     data.cellWidth, data.cellHeight,       // tamaño del recorte
//     x, y,                                  // posición en el canvas
//     data.cellWidth, data.cellHeight        // tamaño dibujado (podés escalar distinto)
//   );
// frameIndex va de 0 a data.columns - 1

const SPRITES = {
  junior: {
  "sheet": "junior.png",
  "rows": [
    {
      "row": 0,
      "y": 0,
      "cellWidth": 142,
      "cellHeight": 166,
      "columns": 3
    },
    {
      "row": 1,
      "y": 166,
      "cellWidth": 129,
      "cellHeight": 166,
      "columns": 3
    },
    {
      "row": 2,
      "y": 332,
      "cellWidth": 112,
      "cellHeight": 166,
      "columns": 3
    },
    {
      "row": 3,
      "y": 498,
      "cellWidth": 128,
      "cellHeight": 166,
      "columns": 3
    }
  ]
},
  bloquear: {
  "sheet": "bloquear.png",
  "rows": [
    {
      "row": 0,
      "y": 0,
      "cellWidth": 269,
      "cellHeight": 434,
      "columns": 4
    }
  ]
},
  caballero: {
  "sheet": "caballero.png",
  "rows": [
    {
      "row": 0,
      "y": 0,
      "cellWidth": 262,
      "cellHeight": 123,
      "columns": 17
    },
    {
      "row": 1,
      "y": 123,
      "cellWidth": 167,
      "cellHeight": 126,
      "columns": 19
    },
    {
      "row": 2,
      "y": 249,
      "cellWidth": 376,
      "cellHeight": 113,
      "columns": 10
    },
    {
      "row": 3,
      "y": 362,
      "cellWidth": 89,
      "cellHeight": 62,
      "columns": 20
    },
    {
      "row": 4,
      "y": 424,
      "cellWidth": 133,
      "cellHeight": 79,
      "columns": 16
    },
    {
      "row": 5,
      "y": 503,
      "cellWidth": 109,
      "cellHeight": 101,
      "columns": 22
    }
  ]
},
  ghost: {
  "sheet": "ghost.png",
  "rows": [
    {
      "row": 0,
      "y": 0,
      "cellWidth": 199,
      "cellHeight": 152,
      "columns": 12
    },
    {
      "row": 1,
      "y": 152,
      "cellWidth": 190,
      "cellHeight": 151,
      "columns": 13
    },
    {
      "row": 2,
      "y": 303,
      "cellWidth": 178,
      "cellHeight": 163,
      "columns": 14
    }
  ]
},
  vampire_king: {
  "sheet": "vampire_king.png",
  "rows": [
    {
      "row": 0,
      "y": 0,
      "cellWidth": 161,
      "cellHeight": 112,
      "columns": 26
    },
    {
      "row": 1,
      "y": 112,
      "cellWidth": 297,
      "cellHeight": 110,
      "columns": 29
    },
    {
      "row": 2,
      "y": 222,
      "cellWidth": 156,
      "cellHeight": 114,
      "columns": 43
    },
    {
      "row": 3,
      "y": 336,
      "cellWidth": 149,
      "cellHeight": 113,
      "columns": 32
    },
    {
      "row": 4,
      "y": 449,
      "cellWidth": 137,
      "cellHeight": 102,
      "columns": 42
    }
  ]
},
  objeto: {
  "sheet": "objeto.png",
  "rows": [
    {
      "row": 0,
      "y": 0,
      "cellWidth": 212,
      "cellHeight": 163,
      "columns": 7
    },
    {
      "row": 1,
      "y": 163,
      "cellWidth": 243,
      "cellHeight": 181,
      "columns": 10
    },
    {
      "row": 2,
      "y": 344,
      "cellWidth": 181,
      "cellHeight": 366,
      "columns": 6
    },
    {
      "row": 3,
      "y": 710,
      "cellWidth": 136,
      "cellHeight": 209,
      "columns": 4
    },
    {
      "row": 4,
      "y": 919,
      "cellWidth": 181,
      "cellHeight": 242,
      "columns": 4
    }
  ]
},
};
