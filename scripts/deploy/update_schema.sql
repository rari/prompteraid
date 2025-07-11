-- Create user_components table for saving prompt configurations
CREATE TABLE IF NOT EXISTS user_components (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    configuration JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries by user_id
CREATE INDEX IF NOT EXISTS idx_user_components_user_id ON user_components(user_id);

-- Create index for ordering by creation date
CREATE INDEX IF NOT EXISTS idx_user_components_created_at ON user_components(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE user_components ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to only see their own components
CREATE POLICY "Users can view their own components" ON user_components
    FOR SELECT USING (auth.uid() = user_id);

-- Create policy to allow users to insert their own components
CREATE POLICY "Users can insert their own components" ON user_components
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create policy to allow users to update their own components
CREATE POLICY "Users can update their own components" ON user_components
    FOR UPDATE USING (auth.uid() = user_id);

-- Create policy to allow users to delete their own components
CREATE POLICY "Users can delete their own components" ON user_components
    FOR DELETE USING (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_user_components_updated_at 
    BEFORE UPDATE ON user_components 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column(); 