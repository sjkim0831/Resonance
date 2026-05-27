#!/usr/bin/env python3
"""
Test RAG system with local model
"""
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import RAG components
from ragg import create_rag_chain, query_rag

def test_rag():
    """Test RAG system with sample queries."""
    
    # Test queries
    queries = [
        "탄소배출 관련 UC는 무엇인가요?",
        "UC-MON001의 사용자는 누구인가요?",
        "UC-MON001의 사용자는 누구인가요?",
    ]
    
    for query in queries:
        print(f"\nQuery: {query}")
        print("=" * 50)
        try:
            result = query_rag(query)
            print(f"\nAnswer: {result}")
        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()
        print()

if __name__ == "__main__":
    test_rag()