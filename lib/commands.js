@interaction(ok='INSERTED', ok_args=['jid'], full='BURIED', full_args=['jid'])
def process_put(data, pri=1, delay=0, ttr=60):
    """
    put
        send:
            put <pri> <delay> <ttr> <bytes>
            <data>

        return:
            INSERTED <jid>
            BURIED <jid>
    NOTE: this function does a check for job size <= max job size, and
    raises a protocol error when the size is too big.
    """
    dlen = len(data)
    if dlen >= MAX_JOB_SIZE:
        raise errors.JobTooBig('Job size is %s (max allowed is %s' %\
            (dlen, MAX_JOB_SIZE))
    putline = 'put %(pri)s %(delay)s %(ttr)s %(dlen)s\r\n%(data)s\r\n'
    return putline % locals()

@interaction('USING', ok_args=['tube'])
def process_use(tube):
    '''
    use
        send:
            use <tube>
        return:
            USING <tube>
    '''
    check_name(tube)
    return 'use %s\r\n' % (tube,)

@interaction('RESERVED', ok_args=['jid','bytes'], has_data=True)
def process_reserve():
    '''
     reserve
        send:
            reserve

        return:
            RESERVED <id> <bytes>
            <data>

            DEADLINE_SOON
    '''
    x = 'reserve\r\n'
    return x

@interaction(ok='DELETED')
def process_delete(jid):
    """
    delete
        send:
            delete <id>

        return:
            DELETED
            NOT_FOUND
    """
    return 'delete %s\r\n' % (jid,)

@interaction(ok='RELEASED', full='BURIED')
def process_release(jid, pri=1, delay=0):
    """
    release
        send:
            release <id> <pri> <delay>

        return:
            RELEASED
            BURIED
            NOT_FOUND
    """
    return 'release %(jid)s %(pri)s %(delay)s\r\n' % locals()

@interaction(ok='BURIED')
def process_bury(jid, pri=1):
    """
    bury
        send:
            bury <id> <pri>

        return:
            BURIED
            NOT_FOUND
    """
    return 'bury %(jid)s %(pri)s\r\n' % locals()

@interaction(ok='WATCHING', ok_args=['count'])
def process_watch(tube):
    '''
    watch
        send:
            watch <tube>
        return:
            WATCHING <tube>
    '''
    check_name(tube)
    return 'watch %s\r\n' % (tube,)

@interaction(ok='WATCHING', ok_args=['count'])
def process_ignore(tube):
    '''
    ignore
        send:
            ignore <tube>
        reply:
            WATCHING <count>

            NOT_IGNORED
    '''
    check_name(tube)
    return 'ignore %s\r\n' % (tube,)

@interaction(ok='FOUND', ok_args=['jid','bytes'], has_data = True)
def process_peek(jid = 0):
    """
    peek
        send:
            peek <id>

        return:
            NOT_FOUND
            FOUND <id> <bytes>
            <data>

    """
    if jid:
        return 'peek %s\r\n' % (jid,)

@interaction(ok='FOUND', ok_args=['jid','bytes'], has_data = True)
def process_peek_ready():
    '''
    peek-ready
        send:
            peek-ready
        return:
            NOT_FOUND
            FOUND
            FOUND <id> <bytes>
    '''
    return 'peek-ready\r\n'

@interaction(ok='FOUND', ok_args=['jid','bytes'], has_data = True)
def process_peek_delayed():
    '''
    peek-delayed
        send:
            peek-delayed
        return:
            NOT_FOUND
            FOUND
            FOUND <id> <bytes>
    '''
    return 'peek-delayed\r\n'

@interaction(ok='FOUND', ok_args=['jid','bytes'], has_data = True)
def process_peek_buried():
    '''
    peek-buried
        send:
            peek-buried
        return:
            NOT_FOUND
            FOUND <id> <bytes>
    '''
    return 'peek-buried\r\n'

@interaction(ok='KICKED', ok_args = ['count'])
def process_kick(bound=10):
    """
    kick
        send:
            kick <bound>

        return:
            KICKED <count>
    """
    return 'kick %s\r\n' % (bound,)

@interaction(ok='OK', ok_args=['bytes'], has_data=True, parse=yaml.load)
def process_stats():
    """
    stats
        send:
            stats
        return:
            OK <bytes>
            <data> (YAML struct)
    """
    return 'stats\r\n'

@interaction(ok='OK', ok_args=['bytes'], has_data=True, parse=yaml.load)
def process_stats_job(jid):
    """
    stats
        send:
            stats-job <jid>
        return:
            OK <bytes>
            <data> (YAML struct)

            NOT_FOUND
    """
    return 'stats-job %s\r\n' % (jid,)

@interaction(ok='OK', ok_args=['bytes'], has_data=True, parse=yaml.load)
def process_stats_tube(tube):
    """
    stats
        send:
            stats-tube <tube>
        return:
            OK <bytes>
            <data> (YAML struct)

            NOT_FOUND
    """
    check_name(tube)
    return 'stats-tube %s\r\n' % (tube,)

@interaction(ok='OK', ok_args=['bytes'], has_data=True, parse=yaml.load)
def process_list_tubes():
    '''
    list-tubes
        send:
            list-tubes
        return:
            OK <bytes>
            <data> (YAML struct)
    '''
    return 'list-tubes\r\n'

@interaction('USING', ok_args = ['tube'])
def process_list_tube_used():
    '''
    list-tube-used
        send:
            list-tubes
        return:
            USING <tube>
    '''
    return 'list-tube-used\r\n'

@interaction(ok='OK', ok_args=['bytes'], has_data=True, parse=yaml.load)
def process_list_tubes_watched():
    '''
    list-tubes-watched
        send:
            list-tubes-watched
        return:
            OK <bytes>
            <data> (YAML struct)
    '''
    return 'list-tubes-watched\r\n'
