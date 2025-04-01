import { ToolBarFeature } from "./ToolBar/tool-bar.js"
import { AccessControl } from "./AccessControl/access-control.js"
import { AACGrid } from "./AAC/grid.js"
import { QuizFeature } from "./Quiz/quiz.js"
import { EyeGazeFeature } from "./EyeGaze/eye-gaze.js"


export const FEATURES = [
    {
        class: ToolBarFeature,
        name: "toolBar",
        layers: [
            {
                type: "panel", 
                area: "tools",
            },
            {
                type: "area",
                area: "fullAspectArea",
                index: 90,
            }
        ],
    },

    {
        class: AACGrid,
        name: "aacGrid",
        layers: [
            {
                type: "area",
                area: "fullAspectArea",
                index: 80,
            }
        ]
    },


    {
        class: QuizFeature,
        name: "quiz",
        layers: [
            {
                type: "area",
                area: "fullAspectArea",
                index: 80,
            }
        ]
    },

    {
        class: AccessControl,
        name: "accessControl",
        layers: [
            {
                type: "area",
                area: "entireScreen",
                index: 210,
            }
        ]
    },

    {
        class: EyeGazeFeature,
        name: "eyeGaze",
        layers: [
            {
                type: "area",
                area: "fullAspectArea",
                index: 85,
            },
            {
                type: "area",
                area: "entireScreen",
                index: 215,
            },
            {
                type: "area",
                area: "entireScreen",
                index: 310,
            }
        ]
    }
]

export function loadResources(){
    FEATURES.map(f => f.class.loadResources())
}
