#!/usr/bin/env python3
"""
获取股票K线数据并保存到指定文件
"""

import argparse
import json
from datetime import datetime, timedelta
from pathlib import Path

try:
    import akshare as ak
    import pandas as pd
except ImportError:
    print("请先安装依赖：pip install akshare pandas")
    exit(1)


def parse_symbol(symbol):
    if not symbol:
        return None, None
    symbol = symbol.strip().upper()
    if symbol.endswith('.SH'):
        return symbol[:-3], 'SH'
    if symbol.endswith('.SZ'):
        return symbol[:-3], 'SZ'
    if symbol.endswith('.HK'):
        return symbol[:-3], 'HK'
    if symbol.endswith('.US'):
        return symbol[:-3], 'US'
    return symbol, 'US'


def fetch_us_stock(symbol, start_date=None, end_date=None):
    code = symbol.replace('.US', '')
    
    if start_date:
        start = start_date.strftime('%Y%m%d')
    else:
        start = (datetime.now() - timedelta(days=365*5)).strftime('%Y%m%d')
    
    if end_date:
        end = end_date.strftime('%Y%m%d')
    else:
        end = datetime.now().strftime('%Y%m%d')
    
    df = ak.stock_us_daily(symbol=code, adjust='qfq')
    if df is not None and not df.empty:
        df.columns = [col.strip() for col in df.columns]
        df['date'] = pd.to_datetime(df['date'])
        if start_date:
            df = df[df['date'] >= pd.Timestamp(start_date)]
        if end_date:
            df = df[df['date'] <= pd.Timestamp(end_date)]
        return df
    return None


def fetch_hk_stock(symbol, start_date=None, end_date=None):
    code = symbol.replace('.HK', '')
    
    df = ak.stock_hk_daily(symbol=code, adjust='qfq')
    if df is not None and not df.empty:
        df.columns = [col.strip() for col in df.columns]
        df['date'] = pd.to_datetime(df['date'])
        return df
    return None


def fetch_a_stock(symbol, start_date=None, end_date=None):
    code = symbol.replace('.SH', '').replace('.SZ', '')
    market_prefix = 'sh' if symbol.endswith('.SH') else 'sz'
    
    if start_date:
        start = start_date.strftime('%Y%m%d')
    else:
        start = (datetime.now() - timedelta(days=365*5)).strftime('%Y%m%d')
    
    if end_date:
        end = end_date.strftime('%Y%m%d')
    else:
        end = datetime.now().strftime('%Y%m%d')
    
    df = ak.stock_zh_a_daily(symbol=f'{market_prefix}{code}', start_date=start, end_date=end, adjust='qfq')
    if df is not None and not df.empty:
        df.columns = [col.strip() for col in df.columns]
        df['date'] = pd.to_datetime(df['date'])
        return df
    return None


def fetch_stock(symbol, start_date=None, end_date=None):
    code, market = parse_symbol(symbol)
    if not code or not market:
        print(f"  无法解析股票代码: {symbol}")
        return None
    
    std_symbol = f"{code}.{market}"
    
    if market == 'US':
        df = fetch_us_stock(std_symbol, start_date, end_date)
    elif market == 'HK':
        df = fetch_hk_stock(std_symbol, start_date, end_date)
    elif market in ('SH', 'SZ'):
        df = fetch_a_stock(std_symbol, start_date, end_date)
    else:
        print(f"  不支持的市场: {market}")
        return None
    
    return df


def main():
    parser = argparse.ArgumentParser(description='获取股票K线数据')
    parser.add_argument('--symbols', '-s', nargs='+', required=True, help='股票代码列表')
    parser.add_argument('--start', help='开始日期 (YYYY-MM-DD)')
    parser.add_argument('--end', help='结束日期 (YYYY-MM-DD)')
    parser.add_argument('--output', '-o', required=True, help='输出文件路径')
    
    args = parser.parse_args()
    
    start_date = None
    end_date = None
    
    if args.start:
        start_date = datetime.strptime(args.start, '%Y-%m-%d')
    if args.end:
        end_date = datetime.strptime(args.end, '%Y-%m-%d')
    
    result = {}
    
    for i, symbol in enumerate(args.symbols, 1):
        print(f"[{i}/{len(args.symbols)}] 获取 {symbol}...")
        df = fetch_stock(symbol, start_date, end_date)
        if df is not None and not df.empty:
            records = df.to_dict(orient='records')
            for record in records:
                if hasattr(record.get('date'), 'isoformat'):
                    record['date'] = record['date'].isoformat()
            result[symbol] = records
            print(f"  -> 获取成功，共 {len(records)} 条数据")
        else:
            print(f"  -> 获取失败")
    
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(f"\n已保存到: {output_path}")


if __name__ == '__main__':
    main()
