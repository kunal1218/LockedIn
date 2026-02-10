CREATE TABLE IF NOT EXISTS marketplace_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(listing_id, buyer_id)
);

CREATE TABLE IF NOT EXISTS marketplace_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES marketplace_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_marketplace_conversations_buyer
  ON marketplace_conversations(buyer_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketplace_conversations_seller
  ON marketplace_conversations(seller_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketplace_messages_conversation
  ON marketplace_messages(conversation_id, created_at ASC);
