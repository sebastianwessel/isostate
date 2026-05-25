export default {
  "_digest": "8dc9d7b42d6c706c60b33f3a6938c70f89e1ca02f69f1d9925b2a714f10cf5a6",
  "_format": "isostate-runtime-bundle",
  "_version": "0.4.0",
  "assets": {
    "bridge": {
      "anchor": [
        0.5,
        0.9
      ],
      "url": "./assets/bridge.svg"
    },
    "canal": {
      "anchor": [
        0.5,
        0.9
      ],
      "url": "./assets/canal.svg"
    },
    "car": {
      "anchor": [
        0.5,
        1
      ],
      "url": "./assets/car.svg"
    },
    "city-office": {
      "anchor": [
        0.5,
        1
      ],
      "url": "./assets/city-office.svg"
    },
    "city-tower": {
      "anchor": [
        0.5,
        1
      ],
      "url": "./assets/city-tower.svg"
    },
    "civic-hall": {
      "anchor": [
        0.5,
        1
      ],
      "url": "./assets/civic-hall.svg"
    },
    "fountain": {
      "anchor": [
        0.5,
        1
      ],
      "url": "./assets/fountain.svg"
    },
    "road-intersection": {
      "anchor": [
        0.5,
        0.9
      ],
      "url": "./assets/road-intersection.svg"
    },
    "road-straight": {
      "anchor": [
        0.5,
        0.9
      ],
      "url": "./assets/road-straight.svg"
    },
    "tree": {
      "anchor": [
        0.5,
        1
      ],
      "url": "./assets/tree.svg"
    }
  },
  "floor": {
    "layer": "ground",
    "origin": [
      0,
      0
    ],
    "size": [
      12,
      9
    ],
    "visible": true
  },
  "grid": {
    "cellSize": 64
  },
  "layers": [
    {
      "name": "ground",
      "order": 0
    },
    {
      "name": "water",
      "order": 1
    },
    {
      "name": "roads",
      "order": 2
    },
    {
      "name": "parks",
      "order": 3
    },
    {
      "name": "structures",
      "order": 4
    },
    {
      "name": "traffic",
      "order": 5
    },
    {
      "name": "routes",
      "order": 6
    },
    {
      "name": "labels",
      "order": 7
    }
  ],
  "layout": {
    "align": [
      0.5,
      0.5
    ],
    "bounds": "union",
    "fit": "contain",
    "padding": {
      "x": 64,
      "y": 64
    }
  },
  "scenes": [
    {
      "connectors": [
        {
          "direction": "route",
          "end": "arrow",
          "enter": "fade-in",
          "exit": "fade-out",
          "id": "primary-avenue",
          "layer": "routes",
          "presence": "present",
          "route": [
            [
              3,
              4
            ],
            [
              5,
              4
            ],
            [
              8,
              4
            ]
          ],
          "start": "none",
          "style": {
            "lane": "center-dashed",
            "opacity": 1,
            "outline": "#f8fafc",
            "outlineWidth": 2,
            "pattern": "solid",
            "stroke": "#5b6470",
            "strokeWidth": 14,
            "variant": "road"
          }
        }
      ],
      "elements": [
        {
          "asset": "rectangle",
          "id": "park-underlay",
          "layer": "parks",
          "pos": [
            2,
            5
          ],
          "presence": "present",
          "primitive": {
            "rectangle": {
              "fill": "#86b957",
              "opacity": 0.28,
              "stroke": "#5f8f2f",
              "strokeWidth": 1
            }
          },
          "size": 3
        },
        {
          "asset": "rectangle",
          "id": "civic-plaza",
          "layer": "ground",
          "pos": [
            5,
            3
          ],
          "presence": "present",
          "primitive": {
            "rectangle": {
              "fill": "#d8cfae",
              "opacity": 0.32,
              "stroke": "#b5a36c",
              "strokeWidth": 1
            }
          },
          "size": 2
        },
        {
          "asset": "canal",
          "id": "canal-west",
          "layer": "water",
          "pos": [
            8,
            5
          ],
          "presence": "present",
          "size": 1
        },
        {
          "asset": "canal",
          "id": "canal-center",
          "layer": "water",
          "pos": [
            9,
            5
          ],
          "presence": "present",
          "size": 1
        },
        {
          "asset": "canal",
          "id": "canal-east",
          "layer": "water",
          "pos": [
            10,
            5
          ],
          "presence": "present",
          "size": 1
        },
        {
          "asset": "road-straight",
          "id": "road-north",
          "layer": "roads",
          "pos": [
            5,
            2
          ],
          "presence": "present",
          "size": 1
        },
        {
          "asset": "road-intersection",
          "id": "road-center",
          "layer": "roads",
          "pos": [
            5,
            4
          ],
          "presence": "present",
          "size": 1
        },
        {
          "asset": "road-straight",
          "id": "road-south",
          "layer": "roads",
          "pos": [
            5,
            6
          ],
          "presence": "present",
          "size": 1
        },
        {
          "asset": "road-straight",
          "id": "road-west",
          "layer": "roads",
          "pos": [
            3,
            4
          ],
          "presence": "present",
          "size": 1
        },
        {
          "asset": "bridge",
          "id": "road-east",
          "layer": "roads",
          "pos": [
            8,
            4
          ],
          "presence": "present",
          "size": 1
        },
        {
          "asset": "civic-hall",
          "enter": "rise-from-ground",
          "id": "civic-anchor",
          "layer": "structures",
          "pos": [
            6,
            4
          ],
          "presence": "present",
          "size": 1
        },
        {
          "asset": "text",
          "id": "main-label",
          "layer": "labels",
          "pos": [
            6,
            2
          ],
          "presence": "present",
          "size": 1,
          "text": {
            "align": "middle",
            "fill": "#0f172a",
            "fontSize": 13,
            "fontWeight": 800,
            "value": "City growth"
          }
        }
      ],
      "id": "district-base",
      "progress": 0
    },
    {
      "camera": {
        "easing": "ease-in-out",
        "padding": 44,
        "target": {
          "at": [
            2,
            2
          ],
          "size": [
            7,
            6
          ],
          "type": "area"
        }
      },
      "connectors": [
        {
          "direction": "route",
          "end": "arrow",
          "enter": "fade-in",
          "exit": "fade-out",
          "id": "primary-avenue",
          "layer": "routes",
          "presence": "present",
          "route": [
            [
              3,
              4
            ],
            [
              5,
              4
            ],
            [
              8,
              4
            ]
          ],
          "start": "none",
          "style": {
            "lane": "center-dashed",
            "opacity": 1,
            "outline": "#f8fafc",
            "outlineWidth": 2,
            "pattern": "solid",
            "stroke": "#5b6470",
            "strokeWidth": 14,
            "variant": "road"
          }
        }
      ],
      "elements": [
        {
          "asset": "rectangle",
          "id": "park-underlay",
          "layer": "parks",
          "pos": [
            2,
            5
          ],
          "presence": "present",
          "primitive": {
            "rectangle": {
              "fill": "#86b957",
              "opacity": 0.28,
              "stroke": "#5f8f2f",
              "strokeWidth": 1
            }
          },
          "size": 3
        },
        {
          "asset": "rectangle",
          "id": "civic-plaza",
          "layer": "ground",
          "pos": [
            5,
            3
          ],
          "presence": "present",
          "primitive": {
            "rectangle": {
              "fill": "#d8cfae",
              "opacity": 0.32,
              "stroke": "#b5a36c",
              "strokeWidth": 1
            }
          },
          "size": 2
        },
        {
          "asset": "canal",
          "id": "canal-west",
          "layer": "water",
          "pos": [
            8,
            5
          ],
          "presence": "present",
          "size": 1
        },
        {
          "asset": "canal",
          "id": "canal-center",
          "layer": "water",
          "pos": [
            9,
            5
          ],
          "presence": "present",
          "size": 1
        },
        {
          "asset": "canal",
          "id": "canal-east",
          "layer": "water",
          "pos": [
            10,
            5
          ],
          "presence": "present",
          "size": 1
        },
        {
          "asset": "road-straight",
          "id": "road-north",
          "layer": "roads",
          "pos": [
            5,
            2
          ],
          "presence": "present",
          "size": 1
        },
        {
          "asset": "road-intersection",
          "id": "road-center",
          "layer": "roads",
          "pos": [
            5,
            4
          ],
          "presence": "present",
          "size": 1
        },
        {
          "asset": "road-straight",
          "id": "road-south",
          "layer": "roads",
          "pos": [
            5,
            6
          ],
          "presence": "present",
          "size": 1
        },
        {
          "asset": "road-straight",
          "id": "road-west",
          "layer": "roads",
          "pos": [
            3,
            4
          ],
          "presence": "present",
          "size": 1
        },
        {
          "asset": "bridge",
          "id": "road-east",
          "layer": "roads",
          "pos": [
            8,
            4
          ],
          "presence": "present",
          "size": 1
        },
        {
          "asset": "civic-hall",
          "enter": "rise-from-ground",
          "id": "civic-anchor",
          "layer": "structures",
          "pos": [
            6,
            4
          ],
          "presence": "present",
          "size": 1
        },
        {
          "asset": "text",
          "id": "main-label",
          "layer": "labels",
          "pos": [
            6,
            2
          ],
          "presence": "present",
          "size": 1,
          "text": {
            "align": "middle",
            "fill": "#0f172a",
            "fontSize": 13,
            "fontWeight": 800,
            "value": "Mixed-use core"
          }
        },
        {
          "asset": "city-tower",
          "enter": "rise-from-ground",
          "id": "north-tower",
          "layer": "structures",
          "pos": [
            4,
            3
          ],
          "presence": "entering",
          "size": 1
        },
        {
          "asset": "city-tower",
          "enter": "rise-from-ground",
          "id": "south-tower",
          "layer": "structures",
          "pos": [
            6,
            6
          ],
          "presence": "entering",
          "size": 1
        },
        {
          "asset": "city-office",
          "enter": "fade-in-grow",
          "id": "west-office",
          "layer": "structures",
          "pos": [
            3,
            5
          ],
          "presence": "entering",
          "size": 1
        },
        {
          "asset": "city-office",
          "enter": "fade-in-grow",
          "id": "east-office",
          "layer": "structures",
          "pos": [
            8,
            3
          ],
          "presence": "entering",
          "size": 1
        },
        {
          "asset": "fountain",
          "enter": "fade-in-grow",
          "id": "fountain",
          "layer": "parks",
          "pos": [
            4,
            6
          ],
          "presence": "entering",
          "size": 1
        },
        {
          "asset": "tree",
          "enter": "fade-in",
          "id": "tree-a",
          "layer": "parks",
          "pos": [
            2,
            5
          ],
          "presence": "entering",
          "size": 1
        },
        {
          "asset": "tree",
          "enter": "fade-in",
          "id": "tree-b",
          "layer": "parks",
          "pos": [
            3,
            6
          ],
          "presence": "entering",
          "size": 1
        },
        {
          "asset": "tree",
          "enter": "fade-in",
          "id": "tree-c",
          "layer": "parks",
          "pos": [
            4,
            5
          ],
          "presence": "entering",
          "size": 1
        },
        {
          "asset": "tree",
          "enter": "fade-in",
          "id": "tree-d",
          "layer": "parks",
          "pos": [
            7,
            3
          ],
          "presence": "entering",
          "size": 1
        },
        {
          "asset": "car",
          "enter": "fade-in",
          "id": "car-west",
          "layer": "traffic",
          "pos": [
            3,
            4
          ],
          "presence": "entering",
          "size": 1
        },
        {
          "asset": "car",
          "enter": "fade-in",
          "id": "car-east",
          "layer": "traffic",
          "pos": [
            8,
            4
          ],
          "presence": "entering",
          "size": 1
        }
      ],
      "id": "growth-core",
      "progress": 0.5
    },
    {
      "camera": {
        "duration": 500,
        "easing": "ease-out",
        "target": {
          "type": "reset"
        }
      },
      "connectors": [
        {
          "direction": "route",
          "end": "arrow",
          "enter": "fade-in",
          "exit": "fade-out",
          "id": "primary-avenue",
          "layer": "routes",
          "presence": "present",
          "route": [
            [
              3,
              4
            ],
            [
              5,
              4
            ],
            [
              8,
              4
            ]
          ],
          "start": "none",
          "style": {
            "lane": "center-dashed",
            "opacity": 1,
            "outline": "#f8fafc",
            "outlineWidth": 2,
            "pattern": "solid",
            "stroke": "#5b6470",
            "strokeWidth": 14,
            "variant": "road"
          }
        },
        {
          "ambient": [
            {
              "name": "flow"
            }
          ],
          "direction": "route",
          "end": "arrow",
          "enter": "fade-in",
          "exit": "fade-out",
          "id": "walking-loop",
          "layer": "routes",
          "presence": "entering",
          "route": [
            [
              4,
              6
            ],
            [
              4,
              5
            ],
            [
              5,
              5
            ],
            [
              5,
              4
            ],
            [
              6,
              4
            ],
            [
              6,
              3
            ],
            [
              7,
              3
            ]
          ],
          "start": "dot",
          "style": {
            "dash": [
              0,
              8
            ],
            "lane": "none",
            "opacity": 1,
            "outlineWidth": 0,
            "pattern": "dotted",
            "stroke": "#0f9f8f",
            "strokeWidth": 4,
            "variant": "line"
          }
        },
        {
          "ambient": [
            {
              "name": "flow"
            }
          ],
          "direction": "route",
          "end": "arrow",
          "enter": "fade-in",
          "exit": "fade-out",
          "id": "growth-link",
          "layer": "routes",
          "presence": "entering",
          "route": [
            [
              5,
              3.5
            ],
            [
              6.5,
              3.5
            ],
            [
              6.5,
              6
            ]
          ],
          "start": "circle",
          "style": {
            "dash": [
              12,
              8
            ],
            "lane": "none",
            "opacity": 1,
            "outlineWidth": 0,
            "pattern": "dashed",
            "stroke": "#f59e0b",
            "strokeWidth": 4,
            "variant": "line"
          }
        }
      ],
      "elements": [
        {
          "asset": "rectangle",
          "id": "park-underlay",
          "layer": "parks",
          "pos": [
            2,
            5
          ],
          "presence": "present",
          "primitive": {
            "rectangle": {
              "fill": "#86b957",
              "opacity": 0.28,
              "stroke": "#5f8f2f",
              "strokeWidth": 1
            }
          },
          "size": 3
        },
        {
          "asset": "rectangle",
          "id": "civic-plaza",
          "layer": "ground",
          "pos": [
            5,
            3
          ],
          "presence": "present",
          "primitive": {
            "rectangle": {
              "fill": "#d8cfae",
              "opacity": 0.32,
              "stroke": "#b5a36c",
              "strokeWidth": 1
            }
          },
          "size": 2
        },
        {
          "asset": "canal",
          "id": "canal-west",
          "layer": "water",
          "pos": [
            8,
            5
          ],
          "presence": "present",
          "size": 1
        },
        {
          "asset": "canal",
          "id": "canal-center",
          "layer": "water",
          "pos": [
            9,
            5
          ],
          "presence": "present",
          "size": 1
        },
        {
          "asset": "canal",
          "id": "canal-east",
          "layer": "water",
          "pos": [
            10,
            5
          ],
          "presence": "present",
          "size": 1
        },
        {
          "asset": "road-straight",
          "id": "road-north",
          "layer": "roads",
          "pos": [
            5,
            2
          ],
          "presence": "present",
          "size": 1
        },
        {
          "asset": "road-intersection",
          "id": "road-center",
          "layer": "roads",
          "pos": [
            5,
            4
          ],
          "presence": "present",
          "size": 1
        },
        {
          "asset": "road-straight",
          "id": "road-south",
          "layer": "roads",
          "pos": [
            5,
            6
          ],
          "presence": "present",
          "size": 1
        },
        {
          "asset": "road-straight",
          "id": "road-west",
          "layer": "roads",
          "pos": [
            3,
            4
          ],
          "presence": "present",
          "size": 1
        },
        {
          "asset": "bridge",
          "id": "road-east",
          "layer": "roads",
          "pos": [
            8,
            4
          ],
          "presence": "present",
          "size": 1
        },
        {
          "asset": "civic-hall",
          "enter": "rise-from-ground",
          "id": "civic-anchor",
          "layer": "structures",
          "pos": [
            6,
            4
          ],
          "presence": "present",
          "size": 1
        },
        {
          "asset": "text",
          "id": "main-label",
          "layer": "labels",
          "pos": [
            6,
            2
          ],
          "presence": "present",
          "size": 1,
          "text": {
            "align": "middle",
            "fill": "#0f172a",
            "fontSize": 13,
            "fontWeight": 800,
            "value": "Preview routes"
          }
        },
        {
          "asset": "city-tower",
          "enter": "rise-from-ground",
          "id": "north-tower",
          "layer": "structures",
          "pos": [
            4,
            3
          ],
          "presence": "present",
          "size": 1
        },
        {
          "asset": "city-tower",
          "enter": "rise-from-ground",
          "id": "south-tower",
          "layer": "structures",
          "pos": [
            6,
            6
          ],
          "presence": "present",
          "size": 1
        },
        {
          "asset": "city-office",
          "enter": "fade-in-grow",
          "id": "west-office",
          "layer": "structures",
          "pos": [
            3,
            5
          ],
          "presence": "present",
          "size": 1
        },
        {
          "asset": "city-office",
          "enter": "fade-in-grow",
          "id": "east-office",
          "layer": "structures",
          "pos": [
            8,
            3
          ],
          "presence": "present",
          "size": 1
        },
        {
          "asset": "fountain",
          "enter": "fade-in-grow",
          "id": "fountain",
          "layer": "parks",
          "pos": [
            4,
            6
          ],
          "presence": "present",
          "size": 1
        },
        {
          "asset": "tree",
          "id": "tree-a",
          "layer": "parks",
          "pos": [
            2,
            5
          ],
          "presence": "present",
          "size": 1
        },
        {
          "asset": "tree",
          "id": "tree-b",
          "layer": "parks",
          "pos": [
            3,
            6
          ],
          "presence": "present",
          "size": 1
        },
        {
          "asset": "tree",
          "id": "tree-c",
          "layer": "parks",
          "pos": [
            4,
            5
          ],
          "presence": "present",
          "size": 1
        },
        {
          "asset": "tree",
          "id": "tree-d",
          "layer": "parks",
          "pos": [
            7,
            3
          ],
          "presence": "present",
          "size": 1
        },
        {
          "asset": "car",
          "id": "car-west",
          "layer": "traffic",
          "pos": [
            3,
            4
          ],
          "presence": "present",
          "size": 1
        },
        {
          "asset": "car",
          "id": "car-east",
          "layer": "traffic",
          "pos": [
            8,
            4
          ],
          "presence": "present",
          "size": 1
        }
      ],
      "id": "preview-routes",
      "progress": 1
    }
  ],
  "theme": "light"
};