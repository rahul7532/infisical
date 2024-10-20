import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { UserSecretsSchema } from "@app/db/schemas";
import { readLimit ,writeLimit} from "@app/server/config/rateLimiter";
import { verifyAuth } from "@app/server/plugins/auth/verify-auth";
import { AuthMode } from "@app/services/auth/auth-type";

export const registerUserSecretManagementRouter = async (server: FastifyZodProvider) => {
  server.route({
    method: "GET",
    url: "/",
    config: {
      rateLimit: readLimit
    },
    schema: {
      querystring: z.object({
        offset: z.coerce.number().min(0).max(100).default(0),
        limit: z.coerce.number().min(1).max(100).default(25)
      }),
      response: {
        200: z.object({
          secrets: z.array(UserSecretsSchema),
          totalCount: z.number()
        })
      }
    },
    onRequest: verifyAuth([AuthMode.JWT]),
    handler: async (req) => {
      const { secrets, totalCount } = await req.server.services.userSecrets.getAllUserSecrets({
        actor: req.permission.type,
        actorId: req.permission.id,
        actorAuthMethod: req.permission.authMethod,
        actorOrgId: req.permission.orgId,
        ...req.query
      });

      return {
        secrets,
        totalCount
      };
    }
  });
  server.route({
    method: "POST",
    url: "/create",
    config: {
      rateLimit: readLimit
    },
    schema: {
      body: z.object({
        credentialType: z.enum(["WEB_LOGIN", "CREDIT_CARD", "SECURE_NOTE"]),
        username: z.string().optional(),
        password: z.string().optional(),
        cardNumber: z.string().optional(),
        expiryDate: z.string().optional(),
        cvv: z.string().optional(),
        title: z.string().optional(),
        content: z.string().optional(),
        organizationId: z.string(),
        userId: z.string()
      }),
      response: {
        200: z.object({
          message: z.string(),
          secretId: z.number().optional()
        })
      }
    },
    onRequest: verifyAuth([AuthMode.JWT]),
    handler: async (req, res) => {
      const newSecret = {
        id: uuidv4(),
        user_id: req.body.userId,
        organization_id: req.body.organizationId,
        type: req.body.credentialType,
        username: req.body.username || null,
        password: req.body.password || null,
        card_number: req.body.cardNumber || null,
        expiry_date: req.body.expiryDate ? new Date(req.body.expiryDate) : null,
        cvv: req.body.cvv || null,
        title: req.body.title || null,
        content: req.body.content || null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await server.services.userSecrets.createUserSecret({ secretData: newSecret });
      return res.status(200).send({
        message: "Credential created successfully"
      });
    }
  });

  server.route({
    method: "PUT",
    url: "/update/:id", 
    config: {
      rateLimit: readLimit
    },
    schema: {
      body: z.object({
        credentialType: z.enum(["WEB_LOGIN", "CREDIT_CARD", "SECURE_NOTE"]).optional(),
        username: z.string().optional(),
        password: z.string().optional(),
        cardNumber: z.string().optional(),
        expiryDate: z.string().optional(),
        cvv: z.string().optional(),
        title: z.string().optional(),
        content: z.string().optional(),
        organizationId: z.string(),
        userId: z.string()
      }),
      response: {
        200: z.object({
          message: z.string(),
          updatedSecretId: z.string().optional() 
        })
      }
    },
    onRequest: verifyAuth([AuthMode.JWT]),  
    handler: async (req, res) => {
      console.log(" req.params.id req.params.id",  req.params.id);
      const secretId = req?.params.id;  
      
      const data = {
        type: req.body?.credentialType ,
        username: req.body?.username ,
        password: req.body?.password ,
        card_number: req.body?.cardNumber,
        expiry_date: req.body?.expiryDate ? new Date(req.body.expiryDate) : req?.body?.expiry_date,
        cvv: req.body?.cvv ,
        title: req.body?.title ,
        content: req.body?.content,
        updatedAt: new Date()
      };
  
      await server.services.userSecrets.updateUserSecret({id:secretId, updateData:data});
  
      return res.status(200).send({
        message: "Credential updated successfully",
        updatedSecretId: secretId
      });
    }
  });


  server.route({
    method: "DELETE",
    url: "/:secretId",
    config: {
      rateLimit: writeLimit
    },
    schema: {
      params: z.object({
        secretId: z.string().uuid(), 
      }),
      response: {
        200: z.object({
          message: z.string(),
          deletedSecret: UserSecretsSchema.optional() 
        })
      }
    },
    onRequest: verifyAuth([AuthMode.JWT]),
    handler: async (req, res) => {
      const { secretId } = req.params;
  
      const deletedSecret = await req.server.services.userSecrets.deleteUserSecretById({ 
        actor: req.permission.type,
        actorId: req.permission.id,
        orgId: req.permission.orgId,
        actorAuthMethod: req.permission.authMethod,
        actorOrgId: req.permission.orgId,
        secretId});
  
      if (!deletedSecret) {
        return res.status(404).send({
          message: "Secret not found"
        });
      }
  
      return res.status(200).send({
        message: "Secret soft deleted successfully",
        deletedSecret
      });
    }
  });
  
  

  
};
