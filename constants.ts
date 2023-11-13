export const addresses = [
    {
        original: {
            id: 1,
            city: 'New York',
            state: 'New York',
            country: 'United States',
        },
        updated: {
            city: 'Updated New York',
            state: 'New York',
            country: 'United States',
        },
    },
];

export const applicationAnswers = [
    {
        original: {
            id: 1,
            date: '2021-01-01T03:00:00.000Z',
            applicationId: 1,
            addressId: 1,
            itemAnswerGroups: [
                {
                    id: 1,
                    itemAnswers: [
                        {
                            id: 1,
                            text: 'Item answer 1',
                            itemId: 1,
                        },
                    ],
                    optionAnswers: [
                        {
                            id: 1,
                            text: 'Option answer 1',
                            itemId: 1,
                            optionId: 1,
                        },
                    ],
                    tableAnswers: [
                        {
                            id: 1,
                            text: 'Table answer 1',
                            itemId: 1,
                            columnId: 1,
                        },
                    ],
                },
            ],
        },
        updated: {
            date: '2021-03-01T03:00:00.000Z',
            addressId: 1,
            itemAnswerGroups: [
                {
                    id: 1,
                    itemAnswers: [
                        {
                            id: 1,
                            text: 'Updated item answer 1',
                        },
                    ],
                    optionAnswers: [
                        {
                            id: 1,
                            text: 'Updated option answer 1',
                        },
                    ],
                    tableAnswers: [
                        {
                            id: 1,
                            text: 'Updated table answer 1',
                        },
                    ],
                },
            ],
        },
    },
];

export const protocols = [
    {
        original: {
            id: 1,
            title: 'Protocol title',
            description: 'Protocol descriptionss',
            enabled: true,
            pages: [
                {
                    id: 1,
                    type: 'ITEMS',
                    placement: 1,
                    protocolId: 1,
                    itemGroups:[
                        {
                            id: 1,
                            type: 'ITEMS',
                            placement: 1,
                            pageId: 1,
                            isRepeatable: true,
                            tableColumns:[{
                                id: 1,
                                text: 'Table columns text',
                                placement: 1,
                                groupId: 1,
                                answers:[{
                                    id: 1,
                                    text: 'Answers text',
                                    itemId: 1,
                                    groupId: 1,
                                    columnId: 1,
                                }]
                            }],
                            items:[{
                                id: 1,
                                text: 'Item text',
                                type: 'TEXTBOX',
                                placement: 1,
                                enabled: true,
                                groupId: 1,
                                itemOptions: [{
                                    id:1,
                                    text: 'Item option text',
                                    placemente: 1,
                                    itemId: 1,
                                }],
                                itemValidations: [{
                                    id: 1,
                                    type: 'MIN',
                                    argument: 'Argument',
                                    costumMessage: 'Costum message',
                                    itemId: 1,
                                }],
                            }],
                        }
                    ]

                }
            ],
        },
        updated: {
            id: 1,
            title: 'All the Types of insects',
            pages: [
                {
                    id: 1,
                    itemGroups:[
                        {
                            id: 1,
                            isRepeatable: false,
                            tableColumns:[{
                                id: 1,
                                answers:[{
                                    id: 1,
                                    text: 'Updated Answers',
                                }]
                            }],
                            items:[{
                                id: 1,
                                itemOptions: [{
                                    id:1,
                                    text: 'Updated Item option text',
                                }],
                                itemValidations: [{
                                    id: 1,
                                    argument: 'Updated argument',
                                    costumMessage: 'Updated costum message',
                                }],
                            }],
                        }
                    ]

                }
            ],
        },
    },
];