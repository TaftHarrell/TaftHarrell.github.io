import pandas as pd

# Load the Excel file
df = pd.read_excel("data/Hurricane Dataset.xlsx", sheet_name=0)

# Identify header rows: 'Time' is empty, 'Date' contains the storm name
header_rows = df['Time'].isna() & df['Date'].notna()

# Create new 'NAME' column and fill it with values from header rows
df['NAME'] = 'Unnamed'
df.loc[header_rows, 'NAME'] = df.loc[header_rows, 'Date']
df['NAME'] = df['NAME'].ffill()

# Create 'ID' by combining 'Date' and 'Time' as strings
df['ID'] = None
df.loc[~header_rows, 'ID'] = df.loc[~header_rows, 'Date'].astype(str) + df.loc[~header_rows, 'Time'].astype(str)

# Forward fill 'ID' from previous valid values
df['ID'] = df['ID'].ffill()

# Remove the header rows
df_cleaned = df[~header_rows]

# Convert lat/lon with compass directions to numeric
def convert_coord(coord):
    if pd.isna(coord):
        return None
    direction = coord[-1]
    value = float(coord[:-1])
    if direction in ['S', 'W']:
        value = -value
    return value

df_cleaned['Latitude'] = df_cleaned['Latitude'].apply(convert_coord)
df_cleaned['Longitude'] = df_cleaned['Longitude'].apply(convert_coord)

# Filter only the necessary columns
columns_to_keep = [
    'NAME', 'Date', 'Time', 'Record identifier', 'Status of System',
    'Latitude', 'Longitude', 'Maximum Sustained Wind'
]

df_filtered = df_cleaned[[col for col in columns_to_keep if col in df_cleaned.columns]]

df_filtered = df_filtered[~((df_filtered['Longitude'].isna()) &  
          (df_filtered['Latitude'].isna()) )]

# Save to CSV
df_filtered.to_csv("Cleaned_Hurricane_Dataset.csv", index=False)
print("Done!")