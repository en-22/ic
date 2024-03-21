import { Response, Request } from 'express';
import { Protocol, ItemType, ItemGroupType, PageType, ItemValidationType, User, Item, UserRole } from '@prisma/client';
import * as yup from 'yup';
import prismaClient from '../services/prismaClient';
import errorFormatter from '../services/errorFormatter';

/*//eu mudei o tablecolumns
- Na criação:
- //Só permitir admin, coordinator e publisher de criar;
- //Não permitir que publisher crie protocolos com outros owners além dele (deixar isso só pra coordenador e admin por ora);
- //Não permitir item dos tipos CHECKBOX, RADIO e SELECT com menos de duas options; Itens que não forem esses três não podem ter options;
- //Não permitir duas validações do mesmo tipo pro mesmo item (dá pra fazer uma unique key composta no schema);
- ²Garantir que os placements sejam únicos e sem faltou -> gaps entre eles (esse tem que ver certinho se precisa ser no controller ou dá pra matar com o yup ou direto no banco pra facilitar, vou dar uma olhada tbm e te aviso)
- Itens do tipo SCALE precisam de pelo menos uma column Itens não SCALE não podem ter columns;

- Na edição:
- ->Tudo que vale pra criação;
- //Não permitir que publisher remova a si mesmo dos owners;
- ?//Não permitir editar objetos não-descendentes do protocolo pai (páginas que pertençam a outro protocolo, groups que pertençam a páginas de outro protocolo, items que pertençam a groups, que pertençam... [esse não precisa fazer a checagem completa, como a gente faz loops aninhados, você sabe que o pai é SEMPRE válido, só precisa checar se o filho realmente pertence àquele pai]);
- Não permitir editar chave estrangeira referenciando o objeto pai;*/

export const checkAuthorizationToCreate = async (user: User) => {
    if(user.role === UserRole.USER || user.role === UserRole.APLICATOR){
        throw new Error('This user is not authorized to create a protocol.');
    }
 };

 export const checkAuthorizationToUpdateAndDeleteProtocol = async (user: User, protocolId: number) => {
    if(user.role !== UserRole.ADMIN){
        const protocol = await prismaClient.protocol.findUnique({
            where: {
                id: protocolId,
                owners: {some: { id: user.id}},
            },
        });

        if (!protocol) {
            throw new Error('This user is not authorized to alter this application.');
        }
    }
 };

 export const validateId = async (protocolId: number) => {//pra que serve?
        const protocol = await prismaClient.application.findUnique({
            where: {
                id: protocolId,
            },
        });

        if (!protocol) {
            throw new Error('The item you are looking for does not exist.');
        }
 };

export const validateItem = async (item: Item) => {
    const ToBeCreatedItem = await prismaClient.item.findUniqueOrThrow({//melhorar
        where: {
            id: item.id,
        },
        include: {
            itemOptions: true,
        }
    })
    if(item.type === ItemType.CHECKBOX || item.type === ItemType.RADIO || item.type === ItemType.SELECT ){
        if(ToBeCreatedItem.itemOptions.length < 2)
               throw new Error('Not enough options.');//fazer funçao
        }else{
            if(ToBeCreatedItem.itemOptions !== null)//n sei se isso ou maior q 0
                throw new Error('Options not allowed.');
    }
};

 async function IsUserTheOnlyOwner(protocolId: number, userId: number) {//É para o publisher
        const ToBeCreatedProtocol = await prismaClient.protocol.findUnique({
            where: {
                id: protocolId,
                owners: {some: { id: userId}},
            },
            include: {
                owners: true,
            }
        })

        if(!ToBeCreatedProtocol || ToBeCreatedProtocol.owners.length > 1)
            throw new Error('User is not the only owner.');
    };

export const validateItemValidation = async (itemId: number) => {
    const item = await prismaClient.item.findUnique({
        where: {
            id: itemId,
        },
        include: {
            itemValidations: true,
        },
    })
    const seenType = new Set();
    let repeatedType = false;

    item?.itemValidations.forEach((ItemValidation) => {
        if(seenType.has(ItemValidation.type)){
            repeatedType = true;
            return;
        }
        seenType.add(ItemValidation.type);
    })

    if(repeatedType)
        throw new Error('No repeated types allowed.');
}

export const createProtocol = async (req: Request, res: Response) => {
    try {
        // Yup schemas

        const tableAnswersSchema = yup.
            object()
            .shape({
                text: yup.string().min(3).max(255).required(),
                itemId: yup.number().required(),  
                groupId: yup.number().required(),    
                columnId: yup.number().required(),
            })
            .noUnknown();

        const tableColumnSchema = yup.
            object()
            .shape({
                text: yup.string().min(3).max(255).required(),
                placement: yup.number().min(1).required(),
                groupId: yup.number().required(),
                answers: yup.array().of(tableAnswersSchema).default([]),
            })
            .noUnknown();    

        const itemOptionsSchema = yup
            .object()
            .shape({
                text: yup.string().min(3).max(255).required(),
                placement: yup.number().min(1).required(),
            })
            .noUnknown();

        const itemValidationsSchema = yup
            .object()
            .shape({
                type: yup.string().oneOf(Object.values(ItemValidationType)).required(),
                argument: yup.string().required(),
                customMessage: yup.string().required(),
                itemId: yup.number().required(),
            })
            .noUnknown();

        const itemsSchema = yup
            .object()
            .shape({
                text: yup.string().min(3).max(255).required(),
                description: yup.string().min(3).max(255).notRequired(),
                enabled: yup.boolean().required(),
                type: yup.string().oneOf(Object.values(ItemType)).required(),
                placement: yup.number().min(1).required(),
                itemOptions: yup.array().of(itemOptionsSchema).default([]),
                itemValidations: yup.array().of(itemValidationsSchema).default([]),
                tableAnswers: yup.array().of(tableAnswersSchema).default([]),
            })
            .noUnknown();

        const itemGroupsSchema = yup
            .object()
            .shape({
                placement: yup.number().min(1).required(),
                isRepeatable: yup.boolean().required(),
                type: yup.string().oneOf(Object.values(ItemGroupType)).required(),
                items: yup.array().of(itemsSchema).min(1).required(),
                tableColumns: yup.array().of(tableColumnSchema).default([]),//antes tava como required e min 1
            })
            .noUnknown();

        const pagesSchema = yup
            .object()
            .shape({
                placement: yup.number().min(1).required(),
                type: yup.string().oneOf(Object.values(PageType)).required(),
                itemGroups: yup.array().of(itemGroupsSchema).default([]),
            })
            .noUnknown();

        const createProtocolSchema = yup
            .object()
            .shape({
                id: yup.number().required(),
                title: yup.string().min(3).max(255).required(),
                description: yup.string().min(3).max(255).notRequired(),
                enabled: yup.boolean().required(),
                pages: yup.array().of(pagesSchema).min(1).required(),
                owners: yup.array().of(yup.number()).min(1).required(),
            })
            .noUnknown();

        const user = req.user as User;

        //await checkAuthorizationToCreate(user);

        //Yup parsing/validation
        const protocol = await createProtocolSchema.validate(req.body, { stripUnknown: true });

        //Multer files
        const files = req.files as Express.Multer.File[];

        // Prisma transaction
        //if(user.role === 'PUBLISHER' )
           // await IsUserTheOnlyOwner(protocol.id, user.id);

        const createdProtocol = await prismaClient.$transaction(async (prisma) => {
            const createdProtocol = await prisma.protocol.create({
                data: {
                    title: protocol.title,
                    description: protocol.description,
                    enabled: protocol.enabled,
                    owners: {
                        connect: protocol.owners.map((owner) => {
                            return { id: owner };
                        }),
                    },
                },
            });

            // Create nested pages as well as nested itemGroups, items, itemOptions and itemValidations
            for (const [pageId, page] of protocol.pages.entries()) {
                
                protocol.pages.map((otherPage) => {
                    if(page.placement === otherPage.placement)
                        throw new Error('This placement is already in use');
                });

                const createdPage = await prisma.page.create({
                    data: {
                        placement: page.placement,
                        protocolId: createdProtocol.id,
                        type: page.type,
                    },
                });
                for (const [itemGroupId, itemGroup] of page.itemGroups.entries()) {

                    page.itemGroups.map((otherGroup) => {
                        if(page.placement === otherGroup.placement)
                            throw new Error('This placement is already in use');
                    });

                    const createdItemGroup = await prisma.itemGroup.create({
                        data: {
                            placement: itemGroup.placement,
                            isRepeatable: itemGroup.isRepeatable,
                            pageId: createdPage.id,
                            type: itemGroup.type,
                        },
                    });

                    for (const [tableColumnId, tableColumn] of itemGroup.tableColumns.entries()){

                        itemGroup.tableColumns.map((otherColumn) => {
                            if(tableColumn.placement === otherColumn.placement)
                                throw new Error('This placement is already in use');
                        });

                        const createdTableColumn = await prisma.tableColumn.create({
                            data: {
                                text: tableColumn.text,
                                placement: tableColumn.placement,
                                groupId: tableColumn.groupId,
                            },
                        });
                        
                        for(const [tableAnswerId, tableAnswer] of tableColumn.answers.entries()){
                            
                            const createdTableAnswer = await prisma.tableAnswer.create({
                                data: {
                                    text: tableAnswer.text,
                                    itemId: tableAnswer.itemId,
                                    groupId: tableAnswer.groupId,
                                    columnId: tableAnswer.columnId,
                                },
                            });
                        }
                    }

                    for (const [itemId, item] of itemGroup.items.entries()) {

                        itemGroup.items.map((otherItem) => {
                            if(item.placement === otherItem.placement)
                                throw new Error('This placement is already in use');
                        });

                        const itemFiles = files
                            .filter((file) => file.fieldname === `pages[${pageId}][itemGroups][${itemGroupId}][items][${itemId}][files]`)
                            .map((file) => {
                                return { path: file.path };
                            });
                        const createdItem = await prisma.item.create({
                            data: {
                                text: item.text,
                                description: item.description,
                                enabled: item.enabled,
                                groupId: createdItemGroup.id,
                                type: item.type,
                                placement: item.placement,
                                files: {
                                    create: itemFiles,
                                },
                            },
                        });

                        for (const [itemValidationId, itemValidation] of item.itemValidations.entries()) {
                            const createdItemValidation = await prisma.itemValidation.create({
                                data: {
                                    type: itemValidation.type,
                                    argument: itemValidation.argument,
                                    customMessage: itemValidation.customMessage,
                                    itemId: createdItem.id,
                                },
                            });
                        }
                        //await validateItem(createdItem);

                        for (const [itemOptionId, itemOption] of item.itemOptions.entries()) {

                            item.itemOptions.map((otherOption) => {
                                if(itemOption.placement === otherOption.placement)
                                    throw new Error('This placement is already in use');
                            });

                            const itemOptionFiles = files
                                .filter(
                                    (file) =>
                                        file.fieldname ===
                                        `pages[${pageId}][itemGroups][${itemGroupId}][items][${itemId}][itemOptions][${itemOptionId}][files]`
                                )
                                .map((file) => {
                                    return { path: file.path };
                                });

                            const createdItemOption = await prisma.itemOption.create({
                                data: {
                                    text: itemOption.text,
                                    placement: itemOption.placement,
                                    itemId: createdItem.id,
                                    files: {
                                        create: itemOptionFiles,
                                    },
                                },
                            });
                        }
                    }
                }
            }
            // Return the created application answer with nested content included
            return await prisma.protocol.findUnique({
                where: {
                    id: createdProtocol.id,
                },
                include: {
                    pages: {
                        include: {
                            itemGroups: {
                                include: {
                                    items: {
                                        include: {
                                            itemOptions: {
                                                include: {
                                                    files: true,
                                                },
                                            },
                                            itemValidations: true,
                                            files: true,
                                        },
                                    },
                                    tableColumns: {
                                        include: {
                                            answers: true,
                                        }
                                    },
                                },
                            },
                        },
                    },
                },
            });
        });
        res.status(201).json({ message: 'Protocol created.', data: createdProtocol });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const updateProtocol = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const id: number = parseInt(req.params.protocolId);

        await validateId(id);

        // Yup schemas

        const UpdatedTableAnswersSchema = yup.
            object()
            .shape({
                id: yup.number(), 
                text: yup.string().min(3).max(255).required(),
                itemId: yup.number().required(),  
                groupId: yup.number().required(),    
                columnId: yup.number().required(),
            })
            .noUnknown();

        const UpdatedTableColumnSchema = yup.
            object()
            .shape({
                id: yup.number(),
                text: yup.string().min(3).max(255).required(),
                placement: yup.number().min(1).required(),
                groupId: yup.number().required(),
                answers: yup.array().of(UpdatedTableAnswersSchema).default([]),
            })
            .noUnknown();    

        const updateItemOptionsSchema = yup
            .object()
            .shape({
                id: yup.number(),
                text: yup.string().min(3).max(255),
                placement: yup.number().min(1),
                itemId: yup.number(),
                filesIds: yup.array().of(yup.number()).default([]),
            })
            .noUnknown();

        const updateItemValidationsSchema = yup
            .object()
            .shape({
                id: yup.number(),
                type: yup.string().oneOf(Object.values(ItemValidationType)),
                argument: yup.string(),
                customMessage: yup.string(),
                itemId: yup.number(),
            })
            .noUnknown();

        const updateItemsSchema = yup
            .object()
            .shape({
                id: yup.number(),
                text: yup.string().min(3).max(255),
                description: yup.string().min(3).max(255).notRequired(),
                enabled: yup.boolean(),
                groupId: yup.number(),
                type: yup.string().oneOf(Object.values(ItemType)),
                placement: yup.number().min(1),
                itemOptions: yup.array().of(updateItemOptionsSchema).default([]),
                itemValidations: yup.array().of(updateItemValidationsSchema).default([]),
                filesIds: yup.array().of(yup.number()).default([]),
                tableAnswers: yup.array().of(UpdatedTableAnswersSchema).default([]),
            })
            .noUnknown();

        const updateItemGroupsSchema = yup
            .object()
            .shape({
                id: yup.number(),
                placement: yup.number().min(1),
                isRepeatable: yup.boolean(),
                pageId: yup.number(),
                type: yup.string().oneOf(Object.values(ItemGroupType)),
                items: yup.array().of(updateItemsSchema).min(1).required(),
                tableColumns: yup.array().of(UpdatedTableColumnSchema).min(1).required(),
            })
            .noUnknown();

        const updatePagesSchema = yup
            .object()
            .shape({
                id: yup.number(),
                placement: yup.number().min(1),
                protocolId: yup.number(),
                type: yup.string().oneOf(Object.values(PageType)),
                itemGroups: yup.array().of(updateItemGroupsSchema).min(1).required(),
            })
            .noUnknown();

        const updateProtocolSchema = yup
            .object()
            .shape({
                id: yup.number().required(),
                title: yup.string().min(3).max(255),
                description: yup.string().min(3).max(255).notRequired(),
                enabled: yup.boolean(),
                pages: yup.array().of(updatePagesSchema).min(1).required(),
                owners: yup.array().of(yup.number()).min(1).required(),
            })
            .noUnknown();

        //Yup parsing/validation
        const protocol = await updateProtocolSchema.validate(req.body, { stripUnknown: true });

        const user = req.user as User;

        await checkAuthorizationToUpdateAndDeleteProtocol(user, protocol.id);

        if(user.role === 'PUBLISHER' ){
            await IsUserTheOnlyOwner(protocol.id, user.id);//eu vou receber o protocol ou quando ele muda?
            if(!protocol.owners.includes(user.id))
                throw new Error('This user cannot remove himself from owners.');
        }

        //Multer files
        const files = req.files as Express.Multer.File[];
        
        // Prisma transaction
        const upsertedProtocol = await prismaClient.$transaction(async (prisma) => {
            // Update protocol
            await prisma.protocol.update({
                where: {
                    id: id,
                },
                data: {
                    title: protocol.title,
                    description: protocol.description,
                    enabled: protocol.enabled,
                    owners: {
                        set: [],
                        connect: protocol.owners.map((owner) => {
                            return { id: owner };
                        }),
                    },
                },
            });
            // Remove pages that are not in the updated protocol
            await prisma.page.deleteMany({
                where: {
                    id: {
                        notIn: protocol.pages.filter((page) => page.id).map((page) => page.id as number),
                    },
                    protocolId: id,
                },
            });
            for (const [pageId, page] of protocol.pages.entries()) {
                // Update existing pages or create new ones
                if(page.protocolId !== protocol.id)//é isso?
                    continue;
                const upsertedPage = page.id
                    ? await prisma.page.update({
                          where: {
                              id: page.id,
                              protocolId: id,
                          },
                          data: {
                              placement: page.placement,
                              type: page.type,
                          },
                      })
                    : await prisma.page.create({
                          data: {
                              protocolId: id as number,
                              placement: page.placement as number,
                              type: page.type as PageType,
                          },
                      });
                // Remove itemGroups that are not in the updated page
                await prisma.itemGroup.deleteMany({
                    where: {
                        id: {
                            notIn: page.itemGroups.filter((itemGroup) => itemGroup.id).map((itemGroup) => itemGroup.id as number),
                        },
                        pageId: upsertedPage.id,
                    },
                });
                for (const [itemGroupId, itemGroup] of page.itemGroups.entries()) {
                    // Update existing itemGroups or create new ones
                    if(itemGroup.pageId !== page.id)
                        continue;
                    const upsertedItemGroup = itemGroup.id
                        ? await prisma.itemGroup.update({
                              where: {
                                  id: itemGroup.id,
                                  pageId: upsertedPage.id,
                              },
                              data: {
                                  placement: itemGroup.placement,
                                  isRepeatable: itemGroup.isRepeatable,
                                  type: itemGroup.type,
                              },
                          })
                        : await prisma.itemGroup.create({
                              data: {
                                  placement: itemGroup.placement as number,
                                  isRepeatable: itemGroup.isRepeatable as boolean,
                                  pageId: upsertedPage.id as number,
                                  type: itemGroup.type as ItemGroupType,
                              },
                          });

                    await prisma.tableColumn.deleteMany({
                        where: {
                            id: {
                                notIn: itemGroup.tableColumns.filter((tableColumn) => tableColumn.id).map((tableColumn) => tableColumn.id as number),
                            },
                            groupId: upsertedItemGroup.id,
                        },
                    });

                    for (const [tableColumnId, tableColumn] of itemGroup.tableColumns.entries()){
                        if(tableColumn.groupId !== itemGroup.id)
                            continue;
                        const upsertedTableColumn = tableColumn.id 
                        ? await prisma.tableColumn.update({
                            where: {
                                groupId: upsertedItemGroup.id,
                                id: tableColumn.id,
                            },
                            data: {
                                text: tableColumn.text,
                                placement: tableColumn.placement,
                                groupId: tableColumn.groupId,
                            },
                        })
                        : await prisma.tableColumn.create({
                            data: {
                                text: tableColumn.text as string,
                                placement: tableColumn.placement as number,
                                groupId: tableColumn.groupId as number,
                            }
                        })

                        await prisma.tableAnswer.deleteMany({
                            where: {
                                id: {
                                    notIn: tableColumn.answers.filter((tableAnswer) => tableAnswer.id).map((tableAnswer) => tableAnswer.id as number),
                                },
                                groupId: upsertedItemGroup.id,
                            },
                        });

                        for(const [tableAnswerId, tableAnswer] of tableColumn.answers.entries()){
                            if(tableAnswer.columnId !== tableColumn.id)
                                continue;
                            const upsertedTableAnswer = tableAnswer.id
                            ? await prisma.tableAnswer.update({
                                where: {
                                    columnId: upsertedTableColumn.id,
                                    id: tableAnswer.id,
                                },
                                data:{
                                    text: tableAnswer.text,
                                    itemId: tableAnswer.itemId,
                                    groupId: tableAnswer.groupId,
                                    columnId: tableAnswer.columnId,
                                },
                            })
                            : await prisma.tableAnswer.create({
                                data: {
                                    text: tableAnswer.text as string,
                                    itemId: tableAnswer.itemId as number,
                                    groupId: tableAnswer.groupId as number,
                                    columnId: tableAnswer.columnId as number,
                                }
                            })
                        }
                    }  

                    // Remove items that are not in the updated itemGroup
                    await prisma.item.deleteMany({
                        where: {
                            id: {
                                notIn: itemGroup.items.filter((item) => item.id).map((item) => item.id as number),
                            },
                            groupId: upsertedItemGroup.id,
                        },
                    });
                    for (const [itemId, item] of itemGroup.items.entries()) {
                        // Update existing items or create new ones
                        if(item.groupId !== itemGroup.id)
                            continue;

                        const upsertedItem = item.id
                            ? await prisma.item.update({
                                  where: {
                                      id: item.id,
                                      groupId: upsertedItemGroup.id,
                                  },
                                  data: {
                                      text: item.text,
                                      description: item.description,
                                      enabled: item.enabled,
                                      type: item.type,
                                      placement: item.placement,
                                  },
                              })
                            : await prisma.item.create({
                                  data: {
                                      text: item.text as string,
                                      description: item.description as string,
                                      enabled: item.enabled as boolean,
                                      groupId: upsertedItemGroup.id as number,
                                      type: item.type as ItemType,
                                      placement: item.placement as number,
                                  },
                              });
                        // Remove files that are not in the updated item
                        await prisma.file.deleteMany({
                            where: {
                                id: {
                                    notIn: item.filesIds as number[],
                                },
                                itemId: upsertedItem.id,
                            },
                        });
                        const itemFiles = files
                            .filter((file) => file.fieldname === `pages[${pageId}][itemGroups][${itemGroupId}][items][${itemId}][files]`)
                            .map((file) => {
                                return { path: file.path, itemId: upsertedItem.id };
                            });

                        // Create new files (updating files is not supported)
                        await prisma.file.createMany({
                            data: itemFiles,
                        });
                        // Remove itemOptions that are not in the updated item
                        await prisma.itemOption.deleteMany({
                            where: {
                                id: {
                                    notIn: item.itemOptions.filter((itemOption) => item.id).map((itemOption) => itemOption.id as number),
                                },
                                itemId: upsertedItem.id,
                            },
                        });
                        for (const [itemOptionId, itemOption] of item.itemOptions.entries()) {
                            // Update existing itemOptions or create new ones
                            if(itemOption.itemId !== item.id)
                                continue;
                            const upsertedItemOption = itemOption.id
                                ? await prisma.itemOption.update({
                                      where: {
                                          id: itemOption.id,
                                          itemId: upsertedItem.id,
                                      },
                                      data: {
                                          text: itemOption.text,
                                          placement: itemOption.placement,
                                      },
                                  })
                                : await prisma.itemOption.create({
                                      data: {
                                          text: itemOption.text as string,
                                          placement: itemOption.placement as number,
                                          itemId: upsertedItem.id as number,
                                      },
                                  });
                            // Remove files that are not in the updated itemOption
                            await prisma.file.deleteMany({
                                where: {
                                    id: {
                                        notIn: itemOption.filesIds as number[],
                                    },
                                    itemOptionId: upsertedItemOption.id,
                                },
                            });
                            const itemOptionFiles = files
                                .filter(
                                    (file) =>
                                        file.fieldname ===
                                        `pages[${pageId}][itemGroups][${itemGroupId}][items][${itemId}][itemOptions][${itemOptionId}][files]`
                                )
                                .map((file) => {
                                    return { path: file.path, itemOptionId: upsertedItemOption.id };
                                });
                            // Create new files (updating files is not supported)
                            await prisma.file.createMany({
                                data: itemOptionFiles,
                            });
                        }
                        // Remove itemValidations that are not in the updated item
                        await prisma.itemValidation.deleteMany({
                            where: {
                                id: {
                                    notIn: item.itemValidations
                                        .filter((itemValidation) => itemValidation.id)
                                        .map((itemValidation) => itemValidation.id as number),
                                },
                                itemId: upsertedItem.id,
                            },
                        });
                        for (const [itemValidationId, itemValidation] of item.itemValidations.entries()) {
                            // Update existing itemValidations or create new ones
                            if(itemValidation.itemId !== item.id)
                                continue;
                            const upsertedItemValidation = itemValidation.id
                                ? await prisma.itemValidation.update({
                                      where: {
                                          id: itemValidation.id,
                                          itemId: upsertedItem.id,
                                      },
                                      data: {
                                          type: itemValidation.type,
                                          argument: itemValidation.argument,
                                          customMessage: itemValidation.customMessage,
                                      },
                                  })
                                : await prisma.itemValidation.create({
                                      data: {
                                          type: itemValidation.type as ItemValidationType,
                                          argument: itemValidation.argument as string,
                                          customMessage: itemValidation.customMessage as string,
                                          itemId: upsertedItem.id as number,
                                      },
                                  });
                        }
                    }
                }
            }
            // Return the updated application answer with nested content included
            return await prisma.protocol.findUnique({
                where: {
                    id: id,
                },
                include: {
                    pages: {
                        include: {
                            itemGroups: {
                                include: {
                                    items: {
                                        include: {
                                            itemOptions: {
                                                include: {
                                                    files: true,
                                                },
                                            },
                                            itemValidations: true,
                                            files: true,
                                        },
                                    },
                                    tableColumns: {
                                        include: {
                                            answers: true,
                                        }
                                    },
                                },
                            },
                        },
                    },
                },
            });
        });
        res.status(200).json({ message: 'Protocol updated.', data: upsertedProtocol });
    } catch (error: any) {
        res.status(400).json({ error: error });
    }
};

export const getAllProtocols = async (req: Request, res: Response): Promise<void> => {
    try {
        // Get all protocols with nested content included
        const protocol: Protocol[] = await prismaClient.protocol.findMany({
            include: {
                pages: {
                    include: {
                        itemGroups: {
                            include: {
                                items: {
                                    include: {
                                        itemOptions: {
                                            include: {
                                                files: true,
                                            },
                                        },
                                        itemValidations: true,
                                        files: true,
                                    },
                                },
                                tableColumns: {
                                    include: {
                                        answers: true,
                                    }
                                },
                            },
                        },
                    },
                },
            },
        });
        res.status(200).json({ message: 'All protocols found.', data: protocol });
    } catch (error: any) {
        res.status(400).json({ error: error });
    }
};

export const getProtocol = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const id: number = parseInt(req.params.protocolId);

        // Get protocol with nested content included
        const protocol: Protocol = await prismaClient.protocol.findUniqueOrThrow({
            where: {
                id,
            },
            include: {
                pages: {
                    include: {
                        itemGroups: {
                            include: {
                                items: {
                                    include: {
                                        itemOptions: {
                                            include: {
                                                files: true,
                                            },
                                        },
                                        itemValidations: true,
                                        files: true,
                                    },
                                },
                                tableColumns: {
                                    include: {
                                        answers: true,
                                    }
                                },
                            },
                        },
                    },
                },
            },
        });

        res.status(200).json({ message: 'Protocol found.', data: protocol });
    } catch (error: any) {
        res.status(400).json({ error: error });
    }
};

export const deleteProtocol = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const id: number = parseInt(req.params.protocolId);

        await validateId(id);

        const user = req.user as User;

        await checkAuthorizationToUpdateAndDeleteProtocol(user, id);

        // Delete protocol
        const deletedProtocol: Protocol = await prismaClient.protocol.delete({
            where: {
                id,
            },
        });

        res.status(200).json({ message: 'Protocol deleted.', data: deletedProtocol });
    } catch (error: any) {
        res.status(400).json({ error: error });
    }
};
