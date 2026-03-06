import { Size } from "cc";

export class MapEditorUIConfig {

    static UIConfig_Object: { url: string, id: string; prefab: string; }[] = [
        {
            id: "gear_100",
            url: "pool/icon/gear_100_icon",
            prefab: "pool/prefab/gear_100"
        },
        {
            id: "gear_101",
            url: "pool/icon/gear_101_icon",
            prefab: "pool/prefab/gear_101"
        },
        {
            id: "gear_102",
            url: "pool/icon/gear_102_icon",
            prefab: "pool/prefab/gear_102"
        },
        {
            id: "gear_103",
            url: "pool/icon/gear_103_icon",
            prefab: "pool/prefab/gear_103"
        },
        {
            id: "gear_104",
            url: "pool/icon/gear_104_icon",
            prefab: "pool/prefab/gear_104"
        },
        {
            id: "gear_105",
            url: "pool/icon/gear_105_icon",
            prefab: "pool/prefab/gear_105"
        },
        {
            id: "gear_106",
            url: "pool/icon/gear_106_icon",
            prefab: "pool/prefab/gear_106"
        },
        {
            id: "gear_107",
            url: "pool/icon/gear_107_icon",
            prefab: "pool/prefab/gear_107"
        },
        {
            id: "gear_108",
            url: "pool/icon/gear_108_icon",
            prefab: "pool/prefab/gear_108"
        },
        {
            id: "ground_100",
            url: "ground/image/ground_100",
            prefab: "ground/prefab/ground_100"
        },
        {
            id: "ground_101",
            url: "ground/image/ground_101",
            prefab: "ground/prefab/ground_101"
        },
        {
            id: "ground_102",
            url: "ground/image/ground_102",
            prefab: "ground/prefab/ground_102"
        },
        {
            id: "floor_100",
            url: "floor/icon/floor_100_icon",
            prefab: "floor/prefab/floor_100"
        },
        {
            id: "floor_101",
            url: "floor/icon/floor_101_icon",
            prefab: "floor/prefab/floor_101"
        },
        {
            id: "wall_100",
            url: "wall/icon/wall_100_icon",
            prefab: "wall/prefab/wall_100"
        },
        {
            id: "wall_101",
            url: "wall/icon/wall_101_icon",
            prefab: "wall/prefab/wall_101"
        },
        {
            id: "tree_100",
            url: "plant/icon/tree_100_icon",
            prefab: "plant/prefab/tree_100"
        },
        {
            id: "tree_101",
            url: "plant/icon/tree_101_icon",
            prefab: "plant/prefab/tree_101"
        },
        {
            id: "tree_102",
            url: "plant/icon/tree_102_icon",
            prefab: "plant/prefab/tree_102"
        }
    ];

    static Tile_Ground: { id: string; }[] = []

    static Tile_Floor: { id: string; }[] = [
        {
            id: "floor_100"
        },
        {
            id: "floor_101"
        }
    ]

    static Tile_Wall: { id: string; }[] = [
        {
            id: "wall_100"
        },
        {
            id: "wall_101"
        }
    ]

    static Tile_Plant: { id: string; size : Size}[] = [
        {
            id: "tree_100",
            size : new Size(64 , 84)
        },
        {
            id: "tree_101",
            size : new Size(64 , 128)
        },
        {
            id: "tree_102",
            size : new Size(64 , 64)
        }
    ]

    static Tile_Decor: { id: string; size : Size}[] = [
        {
            id: "gear_100",
            size : new Size(64 , 128)
        },
        {
            id: "gear_101",
            size : new Size(128 , 128)
        },
        {
            id: "gear_102",
            size : new Size(128 , 64)
        },
        {
            id: "gear_103",
            size : new Size(128 , 64)
        },
        {
            id: "gear_104",
            size : new Size(128 , 128)
        },
        {
            id: "gear_105",
            size : new Size(128 , 128)
        },
        {
            id: "gear_106",
            size : new Size(128 , 128)
        },
        {
            id: "gear_107",
            size : new Size(128 , 128)
        },
        {
            id: "gear_108",
            size : new Size(128 , 128)
        }
    ]

    // static Tile_NPC: { id: string; }[] = [
    //     {
    //         id: "npc_10009"
    //     },
    //     {
    //         id: "npc_10012"
    //     },
    //     {
    //         id: "npc_10016"
    //     },
    //     {
    //         id: "npc_10017"
    //     },
    //     {
    //         id: "npc_10018"
    //     },
    //     {
    //         id: "npc_10020"
    //     },
    //     {
    //         id: "npc_10021"
    //     },
    //     {
    //         id: "npc_10022"
    //     }
    // ]
}

export const NpcActionConfigs: Map<string, { name: string, actions: { actionName: string, actionId: string, actionDescription: string }[] }> = new Map([
    ["100",
        {
            name: "single bed",
            actions: [
                {
                    actionName: "Sleep",
                    actionId: "106",
                    actionDescription: "go to the blue-striped bed and lie down to rest"
                }
            ]
        }
    ],
    ["101",
        {
            name: "double bed",
            actions: [
                {
                    actionName: "Sleep",
                    actionId: "106",
                    actionDescription: "sit or lie on the green bed to take a nap"
                }
            ]
        }
    ],
    ["102",
        {
            name: "computer",
            actions: [
                {
                    actionName: "Type",
                    actionId: "113",
                    actionDescription: "sit at the triple-monitor workstation and type on the keyboard"
                }
            ]
        }
    ],
    ["103",
        {
            name: "drawing board",
            actions: [
                {
                    actionName: "Draw",
                    actionId: "130",
                    actionDescription: "stand in front of the canvas and paint a flower using tools from the box"
                }
            ]
        }
    ],
    ["104",
        {
            name: "stove/counter",
            actions: [
                {
                    actionName: "Cook",
                    actionId: "104",
                    actionDescription: "go to the corner kitchen counter and prepare a simple meal with the pot"
                }
            ]
        }
    ],
    ["105",
        {
            name: "stove/counter",
            actions: [
                {
                    actionName: "Cook",
                    actionId: "104",
                    actionDescription: "use the modern kitchen to cook or bake near the oven and sink"
                }
            ]
        }
    ],
    ["106",
        {
            name: "desk with books",
            actions: [
                {
                    actionName: "Dinning",
                    actionId: "105",
                    actionDescription: "sit at the wooden table and eat a light meal or snack"
                },
                {
                    actionName: "Read",
                    actionId: "116",
                    actionDescription: "sit at the wooden table and read a book or magazine quietly"
                }
            ]
        }
    ],
    ["107",
        {
            name: "desk with books",
            actions: [
                {
                    actionName: "Dinning",
                    actionId: "105",
                    actionDescription: "sit around the white table and eat or drink with others"
                },
                {
                    actionName: "Read",
                    actionId: "116",
                    actionDescription: "sit around the white table and read notes or a newspaper with friends"
                }
            ]
        }
    ],
    ["108",
        {
            name: "desk with books",
            actions: [
                {
                    actionName: "Dinning",
                    actionId: "105",
                    actionDescription: "eat a snack at the orange desk with a drink and paper beside"
                },
                {
                    actionName: "Read",
                    actionId: "116",
                    actionDescription: "read printed documents or a book while sitting at the orange desk"
                }
            ]
        }
    ]
])


