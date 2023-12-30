import fs from 'fs';
import csv from 'csvtojson';

console.log("testing json")

const fightGraph = 
    JSON.parse (fs.readFileSync("./data/fight/states.json", "utf8"))

const statesList =  
    (await csv().fromFile("./data/fight/stateProperties.csv"))
    .map(x => ({
        ...x,
        ...fightGraph.transitions[x.state]
    }))

const states =
    statesList
    .reduce(
        (result,x) => ({
            ...result,
            [x.state] : x
        }),
        {}
    )

const fightGraphValidation = (graph) =>  {

    const allDefinedStates = 
        new Set(
            Object.getOwnPropertyNames (graph.transitions)
            .concat(graph.endsWith)
        )
        
    const allTargetedStates = 
        new Set (
            [...allDefinedStates]
            .map( 
                x => (
                    graph.transitions[x] 
                    && Object.getOwnPropertyNames (graph.transitions[x].transitions)
                )
            )
            .filter(x => !!x)
            .flat(Infinity)
        )

    const unknownStartingStates = 
        graph.startsWith.filter(x => !allDefinedStates.has(x))

    const unknownEndingStates = 
        graph.endsWith.filter(x => !allTargetedStates.has(x))

    const impossibleTransitions = 
        [...allTargetedStates].filter(x => !allDefinedStates.has(x))

    const issues = [
        [ 
            unknownStartingStates.length > 0, 
            () => console.log ("invalid starting states", unknownStartingStates)
        ],
        [ 
            unknownEndingStates.length > 0, 
            () => console.log("invalid ending states", unknownEndingStates)
        ],
        [ 
            impossibleTransitions.length > 0, 
            () => console.log("invalid states", impossibleTransitions)
        ]
    ].filter(x => x[0])

    return issues
}


const issues = fightGraphValidation(fightGraph)
if (issues.length > 0) {
    issues.forEach(x => x[1]())
    process.exit()
}


// console.log(states)

const probable = (n) => (!!n && Math.random() <= n) || 0

const switchProbability = (context, state) => 
    context === 'Center' ? state.centerSwitch : 
    context === 'Cage'? state.cageSwitch :
    0

const newEvent = (array) => (console.log(array), array)

const runAfight = ({start, possibleFinish, graph, fighterA, fighterB }) => {
    let state = graph[start]
    let context = "Center"
    let fighter = [fighterA, fighterB]
    let current = 0
    let events = []
    while(!possibleFinish.has(state)) {
        
        let keepTrying = true
        let choiceNumber = 0

        let switchFighter = 
            probable (switchProbability(context, state))
    
        current = switchFighter ? (current + 1)%2 : current

        let choice = 
            fighterChoice(choiceNumber, fighter[current], state)
         
        while (keepTrying) {

            if (!choice) {
                var fighterHasNoIdea = (choiceNumber === 0)
                current = (current + 1)%2

                choice = fighterChoice(choiceNumber, fighter[current], state)
                if (fighterHasNoIdea && !choice) {
                    events.push (
                        newEvent ([
                            "stuck"
                        ])
                    )
                    keepTrying = false
                }
            }
            else if ( probable (state, context, choice) ) {
                choiceNumber = 0
                keepTrying = false
                state = graph[choice]
                events.push (
                    newEvent ([
                        context = state.newContext ?? context, 
                        fighter[current].name, 
                        newState.state
                    ])
                )
            }
            else {
                choiceNumber ++
                choice = fighterChoice({choiceNumber, fighter : fighter[current], state})
            }
        }

    }
}


console.log("state list",statesList[1]) 
  
const possibleFinish = new Set(fightGraph.endsWith);

const isNumber = value => (typeof value === "number" && !Number.isNaN(value));
const isArray = value => Array.isArray(value)
const properties = obj => Object.getOwnPropertyNames(obj)


const maybeNodesList = 
    statesList
    /**
     * below an example of a pseudo state
     * {
        state: 'KoCounter',
        cageSwitch: '1',
        centerSwitch: '1',
        _: [ 'Center', 'Cage' ],
        transitions: { Ko: 0.3, StandUp: 0.7 }
        }
        w'll expet to get 2 objects from this
     * {
            "name": 'Center/KoCounter',
            "exit": false,
            "switchAttacker":1,
            "transitions": [ ["Center/Ko", 0.3], ["Center/StandUp", 0.7] ]
        }
        {
            "name": 'Cage/KoCounter',
            "exit": false,
            "switchAttacker":1,
            "transitions": [ ["Cage/Ko", 0.3], ["Cage/StandUp", 0.7] ]
        }
     * 
     */
    .map(({state, transitions:transitionsProps, cageSwitch, centerSwitch}) => {
        
        const switchAttacker = { 
            Center : centerSwitch??0,
            Cage: cageSwitch??0
        }

        /**
         * all possible contexts for the state 
         * if there is no defined context the it should be an exit state whick is possible in both contexts
         */
        const contexts = fightGraph.transitions[state]?._??["Center","Cage"];

        /**
         * some states enforce a new context in their transitions (with the "newcontext" property)
         */
        const targetContext = fightGraph.transitions[state]?.newContext??null;


        return ( 
            /**
             * we are going to map each pseudo state to an array of actual state
             * on state per possible context
             */
            contexts
            .map(ctx => {
                /**
                 * some state have no transition (ending state)
                 * the transitions prp is a key value object
                 * and here we get an array
                 */
                const transitions = 
                    transitionsProps
                    ? properties(fightGraph.transitions[state].transitions )
                    : []

                const proba = fightGraph.transitions[state]?.transitions ?? {}
                
                return ({
                    context : ctx,
                    state : state,
                    switchAttacker:switchAttacker[ctx],
                    transitions : 
                        transitions
                        .map (transition => 
                            
                            /**
                             * the transition propability can be either an array or a number
                             */
                            (!isArray(proba[transition]) && !isNumber(proba[transition])
                            ? []
                            : isNumber(proba[transition])
                            ? [proba[transition], proba[transition]]
                            : proba[transition].length === 1
                            ? [proba[transition][0], 0]
                            : proba[transition].length === 2
                            ? proba[transition]
                            : null).map(
                                (prob,i) => (
                                    
                                    !contexts[i] 
                                    ? null
                                    : targetContext
                                    ? [targetContext, `${targetContext}/${transition}`,prob]
                                    : contexts[i] === ctx
                                    ? [contexts[i], `${contexts[i]}/${transition}`,prob]
                                    : null
                                    
                                ) 
                            ).filter(x => !!x)
                        )
                        .flat()
                        .map(([_,b,c]) => [b,c])
                    })
            })
        )
    })
    .flat()
    .map(({context, state, transitions, switchAttacker}) => ({
        name: `${context}/${state}`,
        exit : possibleFinish.has(state),
        switchAttacker,
        transitions
    }))

const validNodes = new Set(maybeNodesList.map(x => x.name))
console.log("************************************************")
console.log("validNodes.size:" ,validNodes.size)
console.log("Cage/KoAttempt:" ,validNodes.has("Cage/KoAttempt"))
console.log("validNodes:" ,validNodes)
console.log("************************************************")


const nodesList = 
    maybeNodesList
    .map(x => ({
        ...x,
        transitions : x.transitions.filter(([name]) => validNodes.has(name))
    }))

const array = nodesList//.map(x => x.name)

console.log(nodesList.length)

fs.writeFileSync("out.json",JSON.stringify(nodesList))
    //.filter(x => x.name.includes('MoveToCage'))
for (let i = 0; i < array.length && i < 50; i++) {
    if (array[i].name === "Cage/StandUp")
    console.log(array[i] )
}

// runAfight ({
//     start : fightGraph.startsWith[0],
//     possibleFinish : new Set(fightGraph.endsWith),
//     graph: states
// })




    