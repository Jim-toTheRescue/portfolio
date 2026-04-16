#!/usr/bin/env python3
"""
获取投资组合标的的历史日K线数据（后复权）
支持：美股、港股、A股

使用方法：
1. 直接指定股票代码：python fetch_kline.py --symbols AAPL.US 00700.HK 600519.SH
2. 从JSON文件读取：python fetch_kline.py --input portfolio.json
3. 查看帮助：python fetch_kline.py --help
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

try:
    import akshare as ak
    import pandas as pd
except ImportError:
    print("请先安装依赖：pip install akshare pandas")
    sys.exit(1)

MAX_RETRIES = 5
RETRY_DELAY = 3

SYMBOL_ALIASES = {
    'US': {
        'FB': ['FB'],
        'META': ['META', 'FB'],
    }
}


MARKET_MAP = {
    'US': {'name': 'us', 'fetch_func': 'stock_us_hist'},
    'HK': {'name': 'hk', 'fetch_func': 'stock_hk_hist'},
    'SH': {'name': 'sh', 'fetch_func': 'stock_zh_a_hist'},
    'SZ': {'name': 'sz', 'fetch_func': 'stock_zh_a_hist'},
}

OUTPUT_DIR = Path('./kline_data')


def parse_symbol(symbol):
    """解析股票代码，返回 (code, market)"""
    if not symbol:
        return None, None
    
    symbol = symbol.strip().upper()
    
    # A股格式：600519.SH, 300750.SZ
    if symbol.endswith('.SH'):
        return symbol[:-3], 'SH'
    if symbol.endswith('.SZ'):
        return symbol[:-3], 'SZ'
    
    # 港股格式：00700.HK
    if symbol.endswith('.HK'):
        return symbol[:-3], 'HK'
    
    # 美股格式：AAPL.US
    if symbol.endswith('.US'):
        return symbol[:-3], 'US'
    
    # 纯代码格式，自动检测
    code = symbol
    if code.isdigit():
        if len(code) == 5:
            return code, 'HK'
        if code.startswith('6'):
            return code, 'SH'
        return code, 'SZ'
    
    return code, 'US'


def fetch_us_stock_hist(symbol, period='daily', start_date=None, end_date=None, adjust='qfq'):
    """获取美股历史数据，自动处理代码映射"""
    code = symbol.replace('.US', '')
    
    if start_date:
        start = start_date.strftime('%Y%m%d')
    else:
        start = (datetime.now() - timedelta(days=365*5)).strftime('%Y%m%d')
    
    if end_date:
        end = end_date.strftime('%Y%m%d')
    else:
        end = datetime.now().strftime('%Y%m%d')
    
    adjust_map = {'hfq': 'qfq', 'qfq': 'qfq', 'None': ''}
    adjust_param = adjust_map.get(adjust, 'qfq')
    
    all_dfs = []
    codes_to_fetch = [code]
    
    if code in SYMBOL_ALIASES.get('US', {}):
        codes_to_fetch = SYMBOL_ALIASES['US'][code]
        print(f"  代码映射: {code} -> {codes_to_fetch}")
    
    for c in codes_to_fetch:
        try:
            df = ak.stock_us_daily(symbol=c, adjust=adjust_param)
            if df is not None and not df.empty:
                df.columns = [col.strip() for col in df.columns]
                if 'date' in df.columns:
                    df['date'] = pd.to_datetime(df['date'])
                    df['symbol'] = c
                    all_dfs.append(df)
        except Exception as e:
            print(f"  获取 {c} 数据失败: {e}")
    
    if not all_dfs:
        return None
    
    combined_df = pd.concat(all_dfs, ignore_index=True)
    
    if 'META' in codes_to_fetch and 'FB' in codes_to_fetch:
        meta_dates = combined_df[combined_df['symbol'] == 'META']['date']
        if not meta_dates.empty:
            meta_start = meta_dates.min()
            combined_df = combined_df[~((combined_df['symbol'] == 'FB') & (combined_df['date'] >= meta_start))]
    
    combined_df = combined_df.drop_duplicates(subset=['date'], keep='last')
    combined_df = combined_df.sort_values('date').reset_index(drop=True)
    
    if start_date:
        combined_df = combined_df[combined_df['date'] >= pd.Timestamp(start_date)]
    if end_date:
        combined_df = combined_df[combined_df['date'] <= pd.Timestamp(end_date)]
    
    if combined_df.empty:
        return None
    
    return combined_df


def fetch_hk_stock_hist(symbol, period='daily', start_date=None, end_date=None, adjust='qfq'):
    """获取港股历史数据（使用新浪接口）"""
    code = symbol.replace('.HK', '')
    
    adjust_map = {'hfq': 'hfq', 'qfq': 'qfq', 'None': ''}
    adjust_param = adjust_map.get(adjust, 'qfq')
    
    try:
        df = ak.stock_hk_daily(
            symbol=code,
            adjust=adjust_param
        )
        
        if df is None or df.empty:
            return None
        
        df.columns = [col.strip() for col in df.columns]
        
        if 'date' in df.columns:
            df['date'] = pd.to_datetime(df['date'])
            if start_date:
                df = df[df['date'] >= pd.Timestamp(start_date)]
            if end_date:
                df = df[df['date'] <= pd.Timestamp(end_date)]
        
        if df.empty:
            return None
        
        return df
    
    except Exception as e:
        print(f"  获取港股 {symbol} 数据失败: {e}")
        return None


def fetch_a_stock_hist(symbol, period='daily', start_date=None, end_date=None, adjust='qfq'):
    """获取A股历史数据（使用新浪接口）"""
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
    
    adjust_map = {'hfq': 'hfq', 'qfq': 'qfq', 'None': ''}
    adjust_param = adjust_map.get(adjust, 'qfq')
    
    try:
        df = ak.stock_zh_a_daily(
            symbol=f'{market_prefix}{code}',
            start_date=start,
            end_date=end,
            adjust=adjust_param
        )
        
        if df is None or df.empty:
            return None
        
        df.columns = [col.strip() for col in df.columns]
        
        if 'date' in df.columns:
            df['date'] = pd.to_datetime(df['date'])
        
        return df
    
    except Exception as e:
        print(f"  获取A股 {symbol} 数据失败: {e}")
        return None


def fetch_stock_hist(symbol, period='daily', start_date=None, end_date=None, adjust='qfq'):
    """获取股票历史数据（统一入口）"""
    code, market = parse_symbol(symbol)
    
    if not code or not market:
        print(f"  无法解析股票代码: {symbol}")
        return None
    
    std_symbol = f"{code}.{market}"
    
    fetch_funcs = {
        'US': fetch_us_stock_hist,
        'HK': fetch_hk_stock_hist,
        'SH': fetch_a_stock_hist,
        'SZ': fetch_a_stock_hist,
    }
    
    fetch_func = fetch_funcs.get(market)
    if not fetch_func:
        print(f"  不支持的市场: {market}")
        return None
    
    try:
        df = fetch_func(std_symbol, period, start_date, end_date, adjust)
        return df
    except Exception as e:
        print(f"  获取 {std_symbol} 数据失败: {e}")
        return None


def load_positions_from_json(json_path):
    """从JSON文件加载持仓数据"""
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        positions = data.get('positions', [])
        if not positions:
            print(f"  JSON文件中没有找到持仓数据")
            return []
        
        symbols = []
        for pos in positions:
            symbol = pos.get('symbol', '')
            if symbol:
                symbols.append(symbol)
        
        return symbols
    
    except FileNotFoundError:
        print(f"  文件不存在: {json_path}")
        return []
    except json.JSONDecodeError:
        print(f"  JSON格式错误: {json_path}")
        return []


def save_to_csv(df, symbol, output_dir):
    """保存数据到CSV文件"""
    output_dir.mkdir(parents=True, exist_ok=True)
    
    filename = f"{symbol.replace('.', '_')}_qfq.csv"
    filepath = output_dir / filename
    
    df.to_csv(filepath, index=False, encoding='utf-8-sig')
    return filepath


def save_to_parquet(df, symbol, output_dir):
    """保存数据到Parquet文件"""
    output_dir.mkdir(parents=True, exist_ok=True)
    
    filename = f"{symbol.replace('.', '_')}_qfq.parquet"
    filepath = output_dir / filename
    
    df.to_parquet(filepath, index=False, engine='pyarrow')
    return filepath


def save_to_json(df, symbol, output_dir):
    """保存数据到JSON文件"""
    output_dir.mkdir(parents=True, exist_ok=True)
    
    filename = f"{symbol.replace('.', '_')}_qfq.json"
    filepath = output_dir / filename
    
    records = df.to_dict(orient='records')
    for record in records:
        if hasattr(record.get('date'), 'isoformat'):
            record['date'] = record['date'].isoformat()
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(records, f, ensure_ascii=False, indent=2)
    
    return filepath


def save_combined_json(data_dict, output_dir):
    """保存数据到JSON文件（按股票代码分key）"""
    output_dir.mkdir(parents=True, exist_ok=True)
    
    filename = 'kline_data.json'
    filepath = output_dir / filename
    
    result = {}
    for symbol, df in data_dict.items():
        df_copy = df.fillna('').copy()
        records = df_copy.to_dict(orient='records')
        for record in records:
            if hasattr(record.get('date'), 'isoformat'):
                record['date'] = record['date'].isoformat()
        result[symbol] = records
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    return filepath


def main():
    parser = argparse.ArgumentParser(
        description='获取投资组合标的的历史日K线数据（后复权）',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
示例：
  python fetch_kline.py --symbols AAPL.US 00700.HK 600519.SH
  python fetch_kline.py --input portfolio.json
  python fetch_kline.py --symbols 600519.SH --start 2020-01-01 --format csv
        '''
    )
    
    parser.add_argument(
        '--symbols', '-s',
        nargs='+',
        help='股票代码列表，如 AAPL.US 00700.HK 600519.SH'
    )
    
    parser.add_argument(
        '--input', '-i',
        help='从JSON文件读取持仓数据'
    )
    
    parser.add_argument(
        '--start',
        help='开始日期 (YYYY-MM-DD)，默认5年前'
    )
    
    parser.add_argument(
        '--end',
        help='结束日期 (YYYY-MM-DD)，默认今天'
    )
    
    parser.add_argument(
        '--adjust',
        choices=['qfq', 'hfq', 'None'],
        default='qfq',
        help='复权方式：qfq=前复权(默认), hfq=后复权, None=不复权'
    )
    
    parser.add_argument(
        '--output', '-o',
        default='./kline_data',
        help='输出目录 (默认: ./kline_data)'
    )
    
    parser.add_argument(
        '--format', '-f',
        choices=['json', 'csv', 'both'],
        default='json',
        help='输出格式：json(默认), csv, both'
    )
    
    args = parser.parse_args()
    
    # 获取股票列表
    symbols = []
    
    if args.input:
        symbols = load_positions_from_json(args.input)
        if not symbols:
            print("未能从JSON文件获取股票列表")
            return
    elif args.symbols:
        symbols = args.symbols
    else:
        print("请指定股票代码 (--symbols) 或输入文件 (--input)")
        parser.print_help()
        return
    
    # 解析日期
    start_date = None
    end_date = None
    
    if args.start:
        try:
            start_date = datetime.strptime(args.start, '%Y-%m-%d')
        except ValueError:
            print(f"日期格式错误: {args.start}，应为 YYYY-MM-DD")
            return
    
    if args.end:
        try:
            end_date = datetime.strptime(args.end, '%Y-%m-%d')
        except ValueError:
            print(f"日期格式错误: {args.end}，应为 YYYY-MM-DD")
            return
    
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"\n开始获取 {len(symbols)} 只股票的历史日K线数据")
    print(f"复权方式: {args.adjust}")
    print(f"输出目录: {output_dir}")
    print("-" * 50)
    
    success_count = 0
    fail_count = 0
    all_data = {}
    
    for i, symbol in enumerate(symbols, 1):
        print(f"\n[{i}/{len(symbols)}] 正在获取: {symbol}")
        
        df = fetch_stock_hist(symbol, start_date=start_date, end_date=end_date, adjust=args.adjust)
        
        if df is not None and not df.empty:
            code, market = parse_symbol(symbol)
            std_symbol = f"{code}.{market}"
            
            df['symbol'] = std_symbol
            all_data[std_symbol] = df
            
            if args.format == 'csv':
                filepath = save_to_csv(df, std_symbol, output_dir)
                print(f"  -> 已保存: {filepath}")
            
            success_count += 1
        else:
            print("获取失败，退出")
            sys.exit(1)
    
    if args.format == 'json' and all_data:
        filepath = save_combined_json(all_data, output_dir)
        print(f"\n  -> 已保存: {filepath}")
    
    print("\n" + "=" * 50)
    print(f"完成！成功: {success_count}, 失败: {fail_count}")
    
    meta_file = output_dir / 'fetch_info.json'
    meta = {
        'fetch_time': datetime.now().isoformat(),
        'adjust': args.adjust,
        'start_date': args.start or '5 years ago',
        'end_date': args.end or 'today',
        'symbols': [
            {
                'symbol': s,
                'code': parse_symbol(s)[0],
                'market': parse_symbol(s)[1]
            }
            for s in symbols
        ],
        'success_count': success_count,
        'fail_count': fail_count
    }
    
    with open(meta_file, 'w', encoding='utf-8') as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)
    
    print(f"元数据已保存: {meta_file}")


if __name__ == '__main__':
    main()
