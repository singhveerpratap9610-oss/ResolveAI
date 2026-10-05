#!/bin/bash
# Setup script for ITSM ML Project

echo "======================================"
echo "ITSM ML Project - Setup Script"
echo "======================================"
echo ""

# Check Python version
echo "Checking Python version..."
python_version=$(python3 --version 2>&1 | awk '{print $2}')
echo "Found Python $python_version"

# Create virtual environment
echo ""
echo "Creating virtual environment..."
python3 -m venv venv

# Activate virtual environment
echo "Activating virtual environment..."
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    source venv/Scripts/activate
else
    source venv/bin/activate
fi

# Upgrade pip
echo ""
echo "Upgrading pip..."
python -m pip install --upgrade pip

# Install requirements
echo ""
echo "Installing dependencies..."
pip install -r requirements.txt

echo ""
echo "======================================"
echo "✓ Setup Complete!"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Activate the virtual environment:"
echo "   - Windows: venv\\Scripts\\activate"
echo "   - Linux/Mac: source venv/bin/activate"
echo ""
echo "2. Run the pipeline:"
echo "   cd src && python main_pipeline.py"
echo ""
echo "3. (Optional) Configure OpenAI API:"
echo "   echo 'OPENAI_API_KEY=your-key' > .env"
echo ""
