const logger = require("pino")({ level: process.env.LOG_LEVEL || "info" });

export class Feed {
  authorization?: string;
  addresses: string = "";
  frontendServer?: string;
  limit = 10;
  offset = 0;

  constructor(addresses: string[]) {
    this.addresses = addresses.map((address) => `'${address}'`).join(", ");
    this.frontendServer = process.env.FRONTEND_SERVER_URL;
  }

  setOffset(offset: string) {
    this.offset = parseInt(offset);
  }

  setAuthorization(authorization?: string) {
    this.authorization = authorization;
  }

  async getAllEvents(block: number) {
    const query = `
      SELECT 'FT' AS event_type, block_height, asset_identifier, tx_hash, asset_event_type, sender, recipient, amount::text AS value
      FROM FT_EVENTS
      WHERE (recipient IN (${this.addresses}) OR sender IN (${this.addresses})) AND block_height > ${block}

      UNION ALL

      SELECT 'NFT' AS event_type, block_height, asset_identifier, tx_hash, asset_event_type, sender, recipient, value
      FROM NFT_EVENTS
      WHERE (recipient IN (${this.addresses}) OR sender IN (${this.addresses})) AND block_height > ${block}

      UNION ALL

      SELECT 'STX' AS event_type, block_height, NULL as asset_identifier, tx_hash, asset_event_type, sender, recipient, amount::text AS value
      FROM STX_EVENTS
      WHERE (recipient IN (${this.addresses}) OR sender IN (${this.addresses})) AND block_height > ${block}
    `;

    const response = await this.fetchQuery(query);

    if (!response.ok) return [];

    const result = await response.json();
    return this.stacksData2Array(result);
  }

  async getBlockHeight() {
    const query = `
      SELECT block_height FROM
      
      (SELECT * FROM TRANSACTIONS 
        WHERE sender_address IN (${this.addresses}) 
            OR token_transfer_recipient_address IN (${this.addresses})
        ORDER BY block_time DESC
        LIMIT ${this.limit} OFFSET ${this.offset}
      ) subquery

      ORDER BY block_height ASC
      LIMIT 1;
    `;

    const response = await this.fetchQuery(query);

    if (!response.ok) return 0;

    const result = await response.json();
    return result;
  }

  async getAllTxs(txHashArray: string[]) {
    const hashes = txHashArray.map((hash) => `'${hash}'`).join(", ");

    const query = `
        SELECT * FROM TRANSACTIONS 

        WHERE sender_address IN (${this.addresses}) 
            OR token_transfer_recipient_address IN (${this.addresses})
            OR tx_hash IN (${hashes})

        ORDER BY block_time DESC

        LIMIT ${this.limit} OFFSET ${this.offset};
    `;

    const response = await this.fetchQuery(query);

    if (!response.ok) return [];

    const result = await response.json();
    return this.stacksData2Array(result);
  }

  async getTokenProperties(identifiers: string[]) {
    const query = `
      SELECT *
      FROM TOKEN_PROPERTIES
      WHERE contract_id IN (${identifiers.map((i) => `'${i}'`).join(", ")})
    `;

    const response = await this.fetchQuery(query);

    if (!response.ok) return [];

    const result = await response.json();
    return this.stacksData2Array(result);
  }

  async getTxsOneQuery() {
    const query = `
      WITH last_block AS (
        SELECT block_height 
        FROM (
            SELECT * 
            FROM TRANSACTIONS 
            WHERE sender_address IN (${this.addresses}) 
                OR token_transfer_recipient_address IN (${this.addresses})
            ORDER BY block_time DESC
            LIMIT ${this.limit} OFFSET ${this.offset}
        ) subquery
        ORDER BY block_height ASC
        LIMIT 1
      ),

      all_events AS (
          SELECT 'FT' AS event_type, block_height, asset_identifier, tx_hash, asset_event_type, sender, recipient, amount::text AS value
          FROM FT_EVENTS
          WHERE (recipient IN (${this.addresses}) OR sender IN (${this.addresses})) 
              AND block_height > (SELECT block_height FROM last_block)

          UNION ALL

          SELECT 'NFT' AS event_type, block_height, asset_identifier, tx_hash, asset_event_type, sender, recipient, value
          FROM NFT_EVENTS
          WHERE (recipient IN (${this.addresses}) OR sender IN (${this.addresses})) 
              AND block_height > (SELECT block_height FROM last_block)

          UNION ALL

          SELECT 'STX' AS event_type, block_height, NULL AS asset_identifier, tx_hash, asset_event_type, sender, recipient, amount::text AS value
          FROM STX_EVENTS
          WHERE (recipient IN (${this.addresses}) OR sender IN (${this.addresses})) 
              AND block_height > (SELECT block_height FROM last_block)
      ),

      all_txs AS (
          SELECT * FROM TRANSACTIONS 
          WHERE sender_address IN (${this.addresses}) 
              OR token_transfer_recipient_address IN (${this.addresses}) 
              OR tx_hash IN (SELECT tx_hash FROM all_events)
          ORDER BY block_time DESC
          LIMIT ${this.limit} OFFSET ${this.offset}
      )

      SELECT 
          txs.tx_type,
          txs.block_time,
          txs.id,
          txs.tx_id,
          txs.tx_hash,
          txs.tx_index,
          txs.raw_result,
          txs.index_block_hash,
          txs.block_hash,
          txs.block_id,
          txs.block_height,
          txs.parent_block_hash,
          txs.burn_block_time,
          txs.parent_burn_block_time,
          txs.type_id,
          txs.anchor_mode,
          txs.status,
          txs.canonical,
          txs.post_conditions,
          txs.nonce,
          txs.fee_rate,
          txs.sponsored,
          txs.sponsor_address,
          txs.sender_address,
          txs.origin_hash_mode,
          txs.event_count,
          txs.microblock_canonical,
          txs.microblock_sequence,
          txs.microblock_hash,
          txs.parent_index_block_hash,
          txs.token_transfer_recipient_address,
          txs.token_transfer_amount,
          txs.token_transfer_memo,
          txs.smart_contract_contract_id,
          txs.smart_contract_source_code,
          txs.contract_call_contract_id,
          txs.contract_call_function_name,
          txs.contract_call_function_args,
          txs.poison_microblock_header_1,
          txs.poison_microblock_header_2,
          txs.coinbase_payload,
          json_agg(evts) AS events 
      FROM all_txs txs
      LEFT JOIN all_events evts 
      ON txs.tx_hash = evts.tx_hash
      GROUP BY 
          txs.tx_type,
          txs.block_time,
          txs.id,
          txs.tx_id,
          txs.tx_hash,
          txs.tx_index,
          txs.raw_result,
          txs.index_block_hash,
          txs.block_hash,
          txs.block_id,
          txs.block_height,
          txs.parent_block_hash,
          txs.burn_block_time,
          txs.parent_burn_block_time,
          txs.type_id,
          txs.anchor_mode,
          txs.status,
          txs.canonical,
          txs.post_conditions,
          txs.nonce,
          txs.fee_rate,
          txs.sponsored,
          txs.sponsor_address,
          txs.sender_address,
          txs.origin_hash_mode,
          txs.event_count,
          txs.microblock_canonical,
          txs.microblock_sequence,
          txs.microblock_hash,
          txs.parent_index_block_hash,
          txs.token_transfer_recipient_address,
          txs.token_transfer_amount,
          txs.token_transfer_memo,
          txs.smart_contract_contract_id,
          txs.smart_contract_source_code,
          txs.contract_call_contract_id,
          txs.contract_call_function_name,
          txs.contract_call_function_args,
          txs.poison_microblock_header_1,
          txs.poison_microblock_header_2,
          txs.coinbase_payload
      ORDER BY txs.block_time DESC;
    `;

    const response = await this.fetchQuery(query);

    if (!response.ok) return [];

    const result = await response.json();
    return this.stacksData2Array(result);
  }

  fetchQuery(query: string) {
    if (!this.frontendServer) {
      return Promise.resolve(new Response(null, { status: 400 }));
    }

    return fetch(this.frontendServer.concat(`/v3/run?backend=stacks`), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.authorization}`,
      },
      body: JSON.stringify({ query, backend: "stacks" }),
    });
  }

  mergeAll(txs: any[], evts: any[]) {
    return txs.map((tx) => {
      return {
        ...tx,
        events: evts.filter((evt) => evt.tx_hash === tx.tx_hash),
      };
    });
  }

  stacksData2Array = (data: any): any[] => {
    if (!data) return [];
    if (!data.order && !data.columns) return data;
    if (data.order.length === 0) return [];
    if (data.columns[data.order[0]].length === 0) return [];
    let length = data.columns[data.order[0]].length;
    let newArray: Record<any, any>[] = [];

    for (let r = 0; r < length; r++) {
      newArray.push({});
      for (let c = 0; c < data.order.length; c++) {
        newArray[r][data.order[c]] = data.columns[data.order[c]][r];
      }
    }

    return newArray;
  };
}
