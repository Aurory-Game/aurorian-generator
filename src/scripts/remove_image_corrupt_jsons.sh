#!/bin/bash

# Check if the folder path argument is provided
if [ -z "$1" ]; then
  echo "Usage: $0 /path/to/your/json/files"
  exit 1
fi

# Folder path from the argument
FOLDER_PATH="$1"

# List of error messages to look for
ERROR_MESSAGES=(
  "Input file contains unsupported image format"
  "pngload: end of stream"
  "Image to composite must have same dimensions or smaller"
  "Input file has corrupt header: pngload: end of stream"
  "pngload: libspng read error"
  "Unknown error"
  "Input file has corrupt header: VipsForeignLoad: \"tempImage.png\" is not a known file format"
  "pngload: libspng read error\npngload: libspng read error"
)

# Loop through all JSON files in the folder
for file in "$FOLDER_PATH"/*.json; do
  if [[ -f "$file" ]]; then
    # Loop through each error message
    for error_message in "${ERROR_MESSAGES[@]}"; do
      # Check if the file contains the error message
      if grep -q "\"error\": \"$error_message\"" "$file"; then
        # If the error message is found, delete the file and break out of the loop
        rm "$file"
        echo "Deleted $file"
        break
      fi
    done
  fi
done

echo "Script execution completed."
