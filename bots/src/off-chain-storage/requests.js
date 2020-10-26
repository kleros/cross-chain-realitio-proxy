import {compose, map, pick} from "ramda";
import {buildKeyConditionExpression, buildSetUpdateExpression, createEnhancedClient} from "./utils";

const {client, batchWrite} = createEnhancedClient();

const requestsTable = process.env.REQUESTS_TABLE_NAME;

const extractStoredData = pick([
  "chainId",
  "questionId",
  "status",
  "requesterAnswer",
  "arbitratorAnswer",
  "latestAnswer",
]);

export async function saveRequests(requests) {
  const createPutRequest = (item) => ({
    PutRequest: {
      Item: item,
    },
  });

  const createBatchItem = compose(createPutRequest, extractStoredData);

  return compose(batchWrite(requestsTable), map(createBatchItem))(requests);
}

export async function fetchAllRequestIds() {
  const data = await client
    .scan({
      TableName: requestsTable,
      ProjectionExpression: "questionId, chainId",
    })
    .promise();

  return data.Items;
}

export async function deleteAllRequests() {
  const createDeleteRequest = (item) => ({
    DeleteRequest: {
      Key: item,
    },
  });

  const requestIds = await fetchAllRequestIds();

  if (requestIds.length === 0) {
    return;
  }

  return compose(batchWrite(requestsTable), map(createDeleteRequest))(requestIds);
}

export async function fetchRequestsByChainIdAndStatus({chainId, status}) {
  const data = await client
    .query({
      TableName: requestsTable,
      IndexName: "byChainIdAndStatus",
      ...buildKeyConditionExpression({chainId, status}),
    })
    .promise();

  return data.Items;
}

export async function fetchRequestsByChainId({chainId}) {
  const data = await client
    .query({
      TableName: requestsTable,
      IndexName: "byChainIdAndStatus",
      ...buildKeyConditionExpression({chainId}),
    })
    .promise();

  return data.Items;
}

export async function updateRequest({questionId, chainId, ...attrs}) {
  const data = await client
    .update({
      TableName: requestsTable,
      Key: {
        questionId,
        chainId,
      },
      ReturnValues: "ALL_NEW",
      ...buildSetUpdateExpression(extractStoredData(attrs)),
    })
    .promise();

  return data.Attributes;
}

export async function removeRequest({questionId, chainId}) {
  const data = await client
    .delete({
      TableName: requestsTable,
      Key: {
        questionId,
        chainId,
      },
      ReturnValues: "ALL_OLD",
    })
    .promise();

  return data.Attributes;
}
